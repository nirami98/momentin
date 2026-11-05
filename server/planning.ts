import { Router } from 'express';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import { isAdmin } from './auth.js';
import { localDate } from '../shared/models.js';
import { addDays, daySchema, goalOn, goalSchema, habitPlanSchema, planOn, scheduled, streaks, weekOf, taskOccurrences, taskSchema, type Entry, type Goal, type PlannedHabit, type Task } from '../shared/planning.js';

const pools=new Map<string,Pool>();
function pool(url:string){let p=pools.get(url);if(!p){p=new Pool({connectionString:url,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true});pools.set(url,p);}return p;}
function provided<T extends object>(original:Record<string,unknown>,parsed:T):Partial<T> {
  return Object.fromEntries(Object.entries(parsed).filter(([key])=>Object.hasOwn(original,key))) as Partial<T>;
}
class Invalid extends Error { constructor(message:string,public status=400){super(message);} }
export type PlanningSnapshot={today:string;habits:PlannedHabit[];entries:Entry[];tasks:Task[];goals:Goal[];annotations:{id:string;habitId:string;date:string;text:string;added:string}[];preferences:{enabled:boolean;quietStart:string;quietEnd:string};streak:ReturnType<typeof streaks>;admin:boolean};
export async function loadPlanning(db:PoolClient,owner:string,today:string,zone:string,weekStart:'monday'|'sunday'='monday'):Promise<PlanningSnapshot>{
  const base=(await db.query('SELECT * FROM habits WHERE owner_id=$1 ORDER BY created_at,id',[owner])).rows;
  const versions=(await db.query('SELECT v.habit_id,v.effective_date::text AS effective_date,v.plan FROM habit_versions v JOIN habits h ON h.id=v.habit_id WHERE h.owner_id=$1 ORDER BY effective_date',[owner])).rows;
  const habits:PlannedHabit[]=base.map(h=>{
    const start=localDate(new Date(h.created_at),zone);
    const defaultPlan=habitPlanSchema.parse({title:h.title,category:h.category,target:Number(h.target),unit:h.unit,measurement:Number.isInteger(Number(h.target))?'count':'number'});
    const v=versions.filter(v=>v.habit_id===h.id).map(v=>({effective:v.effective_date,plan:v.plan}));
    return {id:h.id,start,versions:[{effective:start,plan:defaultPlan},...v]};
  });
  const entries=(await db.query('SELECT habit_id AS "habitId",local_date::text AS date,value::float8 AS value,fallback FROM check_ins WHERE owner_id=$1 ORDER BY local_date',[owner])).rows as Entry[];
  const records=(await db.query('SELECT id,kind,data FROM planning_records WHERE owner_id=$1 ORDER BY created_at,id',[owner])).rows;
  return {today,habits,entries,tasks:records.filter(r=>r.kind==='task').map(r=>({...r.data,id:r.id})),goals:records.filter(r=>r.kind==='goal').map(r=>goalOn({...r.data,id:r.id},today)),
    annotations:records.filter(r=>r.kind==='annotation').map(r=>({...r.data,id:r.id})),
    preferences:records.find(r=>r.kind==='preferences')?.data??{enabled:false,quietStart:'22:00',quietEnd:'08:00'},
    streak:streaks(habits,entries,today,weekStart),admin:false};
}
const templateSchema=z.object({
  title:z.string().trim().min(1).max(100),description:z.string().max(1000).default(''),
  published:z.boolean().default(false),
  imageIds:z.array(z.uuid()).max(3).optional(),
  imageVersion:z.number().int().min(1).optional(),
  habits:z.array(habitPlanSchema).max(50).default([]),
  tasks:z.array(taskSchema).max(50).default([]),
  goals:z.array(goalSchema.omit({habitIds:true,taskIds:true}).extend({habitIndexes:z.array(z.number().int().min(0).max(49)).max(50).default([]),taskIndexes:z.array(z.number().int().min(0).max(49)).max(50).default([])})).max(20).default([]),
}).strict().refine(t=>t.habits.length+t.tasks.length+t.goals.length>0,'Add at least one habit, task or goal.').refine(t=>t.goals.every(g=>g.habitIndexes.every(i=>i<t.habits.length)&&g.taskIndexes.every(i=>i<t.tasks.length)),'Goal links must refer to activities included in this template.');
export function planningRouter(url:()=>string|undefined){
  const router=Router();
  router.use((req,res,next)=>{if(!res.locals.user){res.status(401).json({error:'Sign in to use planning.'});return;}if(!res.locals.profile){res.status(409).json({error:'Complete your account setup first.'});return;}next();});
  router.use(async(req,res,next)=>{
    const connection=url();if(!connection){res.status(503).json({error:'Database is not configured.'});return;}
    const db=await pool(connection).connect();
    try{
      await db.query('BEGIN');
      // Serialize mutations per account; history and goal edits share the same boundary.
      if(req.method!=='GET')await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[res.locals.owner]);
      res.locals.planningDb=db;
      res.locals.commit=async()=>{await db.query('COMMIT');db.release();};
      res.locals.rollback=async()=>{await db.query('ROLLBACK');db.release();};
      next();
    }catch(e){db.release();next(e);}
  });
  const route=(method:'get'|'post'|'put'|'delete',path:string,action:(req:any,res:any,db:PoolClient)=>Promise<unknown>)=>{
    router[method](path,async(req,res,next)=>{
      try{const data=await action(req,res,res.locals.planningDb);await res.locals.commit();res.json(data??{saved:true});}
      catch(e){await res.locals.rollback();if(e instanceof z.ZodError){res.status(400).json({error:e.issues[0]?.message??'Check the form.'});return;}if(e instanceof Invalid){res.status(e.status).json({error:e.message});return;}next(e);}
    });
  };
  const snapshot=(res:any)=>loadPlanning(res.locals.planningDb,res.locals.owner,res.locals.date,res.locals.timeZone,res.locals.profile.weekStart);
  async function record(db:PoolClient,owner:string,id:string,kind:string){
    z.uuid().parse(id);const row=(await db.query('SELECT data FROM planning_records WHERE id=$1 AND owner_id=$2 AND kind=$3 FOR UPDATE',[id,owner,kind])).rows[0];
    if(!row)throw new Invalid('Record not found.',404);return row.data;
  }
  async function saveRecord(db:PoolClient,owner:string,kind:string,data:unknown,id?:string){
    if(id){await db.query('UPDATE planning_records SET data=$1 WHERE id=$2 AND owner_id=$3 AND kind=$4',[JSON.stringify(data),id,owner,kind]);return id;}
    return (await db.query('INSERT INTO planning_records(owner_id,kind,data) VALUES($1,$2,$3) RETURNING id',[owner,kind,JSON.stringify(data)])).rows[0].id as string;
  }
  async function createHabit(db:PoolClient,owner:string,input:unknown,date:string,zone:string,weekStart:'monday'|'sunday'){
    const p=habitPlanSchema.parse(input);p.schedule.weekStart=weekStart;
    const h=(await db.query('INSERT INTO habits(owner_id,title,category,target,unit,created_at) VALUES($1,$2,$3,$4,$5,$6::date::timestamp AT TIME ZONE $7) RETURNING id',[owner,p.title,p.category,p.target,p.unit,date,zone])).rows[0];
    await db.query('INSERT INTO habit_versions VALUES($1,$2,$3)',[h.id,date,JSON.stringify(p)]);return h.id;
  }
  route('get','/export',async(_req,res,db)=>{
    const files=(await db.query("SELECT id,name,mime,octet_length(bytes) AS size FROM private_files WHERE owner_id=$1",[res.locals.owner])).rows;
    const templates=(await db.query('SELECT id,title,description,published,version,content FROM routine_templates WHERE creator_id=$1',[res.locals.owner])).rows;
    const templateImages=(await db.query("SELECT i.id,i.template_id,i.version,i.name,i.mime,octet_length(i.bytes) AS size FROM template_images i JOIN routine_templates t ON t.id=i.template_id WHERE t.creator_id=$1",[res.locals.owner])).rows;
    const templateVersions=(await db.query('SELECT v.* FROM template_versions v JOIN routine_templates t ON t.id=v.template_id WHERE t.creator_id=$1',[res.locals.owner])).rows;
    const feedback=(await db.query('SELECT template_id,bookmarked,rating FROM template_feedback WHERE owner_id=$1',[res.locals.owner])).rows;
    return {templateImages:templateImages.map(i=>({...i,downloadPath:'/api/files/public/'+i.id})),templateVersions,feedback,exportedAt:new Date().toISOString(),account:{email:res.locals.user.email,name:res.locals.user.name},profile:res.locals.profile,planning:await snapshot(res),files:files.map(f=>({...f,downloadPath:'/api/files/'+f.id})),templates};
  });
  route('get','/',async(_req,res)=>({...await snapshot(res),admin:isAdmin(res.locals.user.email)}));
  route('post','/habits',async(req,res,db)=>({id:await createHabit(db,res.locals.owner,req.body,res.locals.date,res.locals.timeZone,res.locals.profile.weekStart)}));
  route('put','/habits/:id',async(req,res,db)=>{
    const p=habitPlanSchema.parse(req.body),s=await snapshot(res);
    if(!s.habits.some(h=>h.id===req.params.id))throw new Invalid('Habit not found.',404);
    // All configuration edits are prospective, including pause/archive/resume.
    const current=planOn(s.habits.find(h=>h.id===req.params.id)!,res.locals.date)!;
    p.schedule.weekStart=current.schedule.weekStart??res.locals.profile.weekStart;
    const weeklyChange=(current.schedule.kind==='weekly'||p.schedule.kind==='weekly')&&(current.schedule.kind!==p.schedule.kind||current.schedule.times!==p.schedule.times);
    const effective=weeklyChange?addDays(weekOf(res.locals.date,p.schedule.weekStart),7):addDays(res.locals.date,1);
    await db.query('INSERT INTO habit_versions VALUES($1,$2,$3) ON CONFLICT(habit_id,effective_date) DO UPDATE SET plan=EXCLUDED.plan',[req.params.id,effective,JSON.stringify(p)]);
    return {effective};
  });
  route('put','/habits/:id/check-in',async(req,res,db)=>{
    const input=z.object({date:daySchema,value:z.number().min(0).max(100000),fallback:z.boolean().default(false)}).strict().parse(req.body);
    if(input.date!==res.locals.date)throw new Invalid('This day is locked. Add a dated annotation instead.',409);
    const s=await snapshot(res),h=s.habits.find(h=>h.id===req.params.id);
    if(!h)throw new Invalid('Habit not found.',404);
    const p=planOn(h,input.date)!;
    if(!scheduled(h,input.date))throw new Invalid('This habit is paused, archived, or not scheduled today.',409);
    if(['count','checkbox'].includes(p.measurement)&&!Number.isInteger(input.value))throw new Invalid('Enter a whole number.');
    if(p.measurement==='checkbox'&&input.value>1)throw new Invalid('Checkbox progress is 0 or 1.');
    await db.query('INSERT INTO check_ins(owner_id,habit_id,local_date,value,fallback) VALUES($1,$2,$3,$4,$5) ON CONFLICT(habit_id,local_date) DO UPDATE SET value=EXCLUDED.value,fallback=EXCLUDED.fallback,updated_at=now()',[res.locals.owner,h.id,input.date,input.value,input.fallback]);
  });
  route('post','/annotations',async(req,res,db)=>{
    const input=z.object({habitId:z.uuid(),date:daySchema,text:z.string().trim().min(1).max(1000)}).strict().parse(req.body);
    const s=await snapshot(res);if(!s.habits.some(h=>h.id===input.habitId&&h.start<=input.date)||input.date>res.locals.date)throw new Invalid('Choose an existing habit and a current or past date.');
    await saveRecord(db,res.locals.owner,'annotation',{...input,added:new Date().toISOString()});
  });
  route('post','/tasks',async(req,res,db)=>{await saveRecord(db,res.locals.owner,'task',{...taskSchema.parse(req.body),completions:{},checks:{}});});
  route('put','/tasks/:id',async(req,res,db)=>{
    const old=await record(db,res.locals.owner,req.params.id,'task');
    const input=provided(req.body,taskSchema.partial().parse(req.body));
    if((old.due<res.locals.date || Object.keys(old.completions).length>0) && ((input.due!==undefined&&input.due!==old.due)||(input.repeatDays!==undefined&&input.repeatDays!==old.repeatDays)))throw new Invalid('Past occurrences keep their original schedule. Archive this task and create a new one to change recurrence.',409);
    if(Object.keys(old.completions).length && input.subtasks && JSON.stringify(input.subtasks)!==JSON.stringify(old.subtasks))throw new Invalid('Completed task subtasks are locked. Duplicate the task to change them.',409);
    await saveRecord(db,res.locals.owner,'task',{...old,...input},req.params.id);
  });
  route('put','/tasks/:id/progress',async(req,res,db)=>{
    const input=z.object({due:daySchema,done:z.boolean(),checks:z.array(z.number().int().min(0)).max(30)}).strict().parse(req.body);
    const t=await record(db,res.locals.owner,req.params.id,'task') as Task;
    if(!taskOccurrences(t,t.due,addDays(res.locals.date,366)).includes(input.due))throw new Invalid('This task occurrence is not available yet.');
    if(t.completions[input.due]?.date<res.locals.date)throw new Invalid('This completion is locked.',409);
    if(input.checks.some(i=>i>=t.subtasks.length))throw new Invalid('Invalid subtask.');
    if(input.done&&new Set(input.checks).size!==t.subtasks.length)throw new Invalid('Complete all subtasks first.');
    t.checks[input.due]=[...new Set(input.checks)];
    if(input.done)t.completions[input.due]={date:res.locals.date,subtasks:t.checks[input.due]};
    else delete t.completions[input.due];
    await saveRecord(db,res.locals.owner,'task',t,req.params.id);
  });
  route('post','/goals',async(req,res,db)=>{
    const g=goalSchema.parse(req.body),s=await snapshot(res);
    if(g.habitIds.some(id=>!s.habits.some(h=>h.id===id))||g.taskIds.some(id=>!s.tasks.some(t=>t.id===id)))throw new Invalid('Link only your own activities.');
    await saveRecord(db,res.locals.owner,'goal',{...g,start:res.locals.date,versions:[{effective:res.locals.date,plan:g}],achieved:{}});
  });
  route('put','/goals/:id',async(req,res,db)=>{
    const g=await record(db,res.locals.owner,req.params.id,'goal');
    const input=provided(req.body,goalSchema.partial().parse(req.body)),s=await snapshot(res);
    if(input.habitIds?.some(id=>!s.habits.some(h=>h.id===id))||input.taskIds?.some(id=>!s.tasks.some(t=>t.id===id)))throw new Invalid('Link only your own activities.');
    if(input.milestones && Object.keys(g.achieved).some(i=>input.milestones![Number(i)]!==goalOn(g,res.locals.date).milestones[Number(i)]))throw new Invalid('Achieved milestones cannot be removed or renamed.',409);
    const effective=addDays(res.locals.date,1);
    const next=goalSchema.strip().parse({...goalOn(g,effective),...input});
    const versions=(g.versions??[{effective:g.start??res.locals.date,plan:goalSchema.strip().parse(g)}]).filter((v:{effective:string})=>v.effective!==effective);
    await saveRecord(db,res.locals.owner,'goal',{...g,versions:[...versions,{effective,plan:next}]},req.params.id);
    return {effective};
  });
  route('put','/goals/:id/milestone',async(req,res,db)=>{
    const input=z.object({index:z.number().int().min(0),done:z.boolean()}).strict().parse(req.body);
    const g=await record(db,res.locals.owner,req.params.id,'goal') as Goal;
    if(input.index>=goalOn(g,res.locals.date).milestones.length)throw new Invalid('Milestone not found.');
    if(g.achieved[input.index]&&g.achieved[input.index]<res.locals.date)throw new Invalid('This milestone is locked.',409);
    if(input.done)g.achieved[input.index]=res.locals.date;else delete g.achieved[input.index];
    await saveRecord(db,res.locals.owner,'goal',g,req.params.id);
  });
  route('put','/preferences',async(req,res,db)=>{
    const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    const p=z.object({enabled:z.boolean(),quietStart:clock,quietEnd:clock}).strict().parse(req.body);
    await db.query("DELETE FROM planning_records WHERE owner_id=$1 AND kind='preferences'",[res.locals.owner]);
    await saveRecord(db,res.locals.owner,'preferences',p);
  });
  route('get','/templates',async(_req,res,db)=>{
    return (await db.query(`SELECT t.id,t.title,t.description,t.published,t.moderated,t.version,t.content,t.creator_id=$1 AS mine,
      COALESCE((SELECT json_agg(json_build_object('id',i.id,'name',i.name)) FROM template_images i WHERE i.template_id=t.id AND i.version=t.version),'[]') AS images,
      COALESCE(u.name,'Former member') AS creator,COALESCE(f.bookmarked,false) AS bookmarked,f.rating,
      (SELECT avg(rating)::float8 FROM template_feedback WHERE template_id=t.id) AS "averageRating"
      FROM routine_templates t LEFT JOIN auth_user u ON u.id=t.creator_id
      LEFT JOIN template_feedback f ON f.template_id=t.id AND f.owner_id=$1
      WHERE t.creator_id=$1 OR (t.published AND NOT t.moderated) ORDER BY t.updated_at DESC LIMIT 200`,[res.locals.owner])).rows;
  });
  async function snapshotImages(db:PoolClient,owner:string,templateId:string,ids:string[]|undefined,version:number,sourceVersion?:number){
    const rows=ids===undefined?(await db.query('SELECT name,mime,bytes FROM template_images WHERE template_id=$1 AND version=$2',[templateId,sourceVersion??version-1])).rows:(await db.query('SELECT name,mime,bytes FROM private_files WHERE owner_id=$1 AND id=ANY($2::uuid[])',[owner,ids])).rows;
    if(ids!==undefined&&rows.length!==new Set(ids).size)throw new Invalid('Choose only your own private images.');
    const used=Number((await db.query('SELECT COALESCE(sum(octet_length(i.bytes)),0) AS used FROM template_images i JOIN routine_templates t ON t.id=i.template_id WHERE t.creator_id=$1',[owner])).rows[0].used);
    if(used+rows.reduce((n,r)=>n+r.bytes.length,0)>25*1024*1024)throw new Invalid('Your published template image allowance is full.');
    await db.query('DELETE FROM template_images WHERE template_id=$1 AND version=$2',[templateId,version]);
    for(const image of rows)await db.query('INSERT INTO template_images(template_id,name,mime,bytes,version) VALUES($1,$2,$3,$4,$5)',[templateId,image.name,image.mime,image.bytes,version]);
  }
  route('get','/templates/:id/versions',async(req,res,db)=>{
    const own=(await db.query('SELECT id FROM routine_templates WHERE id=$1 AND creator_id=$2',[z.uuid().parse(req.params.id),res.locals.owner])).rows[0];
    if(!own)throw new Invalid('Template not found.',404);
    return (await db.query("SELECT v.version,v.content,COALESCE((SELECT json_agg(json_build_object('id',i.id,'name',i.name)) FROM template_images i WHERE i.template_id=v.template_id AND i.version=v.version),'[]') AS images FROM template_versions v WHERE v.template_id=$1 ORDER BY v.version DESC",[own.id])).rows;
  });
  route('post','/templates',async(req,res,db)=>{
    const t=templateSchema.parse(req.body);
    const content={habits:t.habits,tasks:t.tasks,goals:t.goals};
    const row=(await db.query('INSERT INTO routine_templates(creator_id,title,description,published,content) VALUES($1,$2,$3,$4,$5) RETURNING id',[res.locals.owner,t.title,t.description,t.published,JSON.stringify(content)])).rows[0];
    await db.query('INSERT INTO template_versions VALUES($1,1,$2)',[row.id,JSON.stringify(content)]);await snapshotImages(db,res.locals.owner,row.id,t.imageIds,1);return row;
  });
  route('put','/templates/:id',async(req,res,db)=>{
    const t=templateSchema.parse(req.body);
    const content={habits:t.habits,tasks:t.tasks,goals:t.goals};
    const row=(await db.query('UPDATE routine_templates SET title=$1,description=$2,published=$3,content=$4,version=version+1,updated_at=now() WHERE id=$5 AND creator_id=$6 AND NOT moderated RETURNING version',[t.title,t.description,t.published,JSON.stringify(content),z.uuid().parse(req.params.id),res.locals.owner])).rows[0];
    if(!row)throw new Invalid('Template not found or awaiting moderation.',404);
    await db.query('INSERT INTO template_versions VALUES($1,$2,$3)',[req.params.id,row.version,JSON.stringify(content)]);await snapshotImages(db,res.locals.owner,req.params.id,t.imageIds,row.version,t.imageVersion);
  });
  route('delete','/templates/:id',async(req,res,db)=>{
    const deleted=await db.query('DELETE FROM routine_templates WHERE id=$1 AND creator_id=$2 RETURNING id',[z.uuid().parse(req.params.id),res.locals.owner]);
    if(!deleted.rowCount)throw new Invalid('Template not found.',404);
  });
  route('post','/templates/:id/copy',async(req,res,db)=>{
    const row=(await db.query('SELECT content FROM routine_templates WHERE id=$1 AND (creator_id=$2 OR (published AND NOT moderated)) FOR SHARE',[z.uuid().parse(req.params.id),res.locals.owner])).rows[0];
    if(!row)throw new Invalid('Template is unavailable.',404);
    const images=(await db.query('SELECT i.name,i.mime,i.bytes FROM template_images i JOIN routine_templates t ON t.id=i.template_id WHERE i.template_id=$1 AND i.version=t.version',[req.params.id])).rows;
    const used=Number((await db.query('SELECT COALESCE(sum(octet_length(bytes)),0) AS used FROM private_files WHERE owner_id=$1',[res.locals.owner])).rows[0].used);
    if(used+images.reduce((n,r)=>n+r.bytes.length,0)>25*1024*1024)throw new Invalid('This routine would exceed your private image allowance.');
    for(const image of images)await db.query('INSERT INTO private_files(owner_id,name,mime,bytes) VALUES($1,$2,$3,$4)',[res.locals.owner,image.name,image.mime,image.bytes]);
    const habitIds:string[]=[],taskIds:string[]=[];
    for(const h of row.content.habits)habitIds.push(await createHabit(db,res.locals.owner,{...h,paused:false,archived:false},res.locals.date,res.locals.timeZone,res.locals.profile.weekStart));
    for(const t of row.content.tasks)taskIds.push(await saveRecord(db,res.locals.owner,'task',{...t,due:res.locals.date,archived:false,completions:{},checks:{}}));
    for(const source of row.content.goals){
      const {habitIndexes=[],taskIndexes=[],...g}=source;
      const plan={...g,habitIds:habitIndexes.map((i:number)=>habitIds[i]),taskIds:taskIndexes.map((i:number)=>taskIds[i]),archived:false};
      await saveRecord(db,res.locals.owner,'goal',{...plan,start:res.locals.date,versions:[{effective:res.locals.date,plan}],achieved:{}});
    }
  });
  route('put','/templates/:id/feedback',async(req,res,db)=>{
    const input=z.object({bookmarked:z.boolean(),rating:z.number().int().min(1).max(5).nullable()}).strict().parse(req.body);
    const row=(await db.query('SELECT id FROM routine_templates WHERE id=$1 AND published AND NOT moderated',[z.uuid().parse(req.params.id)])).rows[0];
    if(!row)throw new Invalid('Template unavailable.',404);
    await db.query('INSERT INTO template_feedback VALUES($1,$2,$3,$4) ON CONFLICT(template_id,owner_id) DO UPDATE SET bookmarked=EXCLUDED.bookmarked,rating=EXCLUDED.rating',[row.id,res.locals.owner,input.bookmarked,input.rating]);
  });
  route('post','/templates/:id/report',async(req,res,db)=>{
    const input=z.object({reason:z.string().trim().min(1).max(1000)}).strict().parse(req.body);
    const row=(await db.query('SELECT id FROM routine_templates WHERE id=$1 AND published AND NOT moderated',[z.uuid().parse(req.params.id)])).rows[0];
    if(!row)throw new Invalid('Template unavailable.',404);
    await db.query('INSERT INTO template_reports(template_id,reporter_id,reason) VALUES($1,$2,$3)',[row.id,res.locals.owner,input.reason]);
  });
  route('get','/reports',async(_req,res,db)=>{
    if(!isAdmin(res.locals.user.email))throw new Invalid('Admin access required.',403);
    return (await db.query('SELECT r.id,r.reason,r.resolved,t.id AS "templateId",t.title,t.description,t.content FROM template_reports r JOIN routine_templates t ON t.id=r.template_id WHERE NOT r.resolved ORDER BY r.created_at')).rows;
  });
  route('put','/reports/:id',async(req,res,db)=>{
    if(!isAdmin(res.locals.user.email))throw new Invalid('Admin access required.',403);
    const {remove}=z.object({remove:z.boolean()}).strict().parse(req.body);
    const r=(await db.query('UPDATE template_reports SET resolved=true WHERE id=$1 RETURNING template_id',[z.uuid().parse(req.params.id)])).rows[0];
    if(!r)throw new Invalid('Report not found.',404);
    if(remove)await db.query('UPDATE routine_templates SET moderated=true,published=false WHERE id=$1',[r.template_id]);
  });
  router.use(async(_req,res)=>{await res.locals.rollback();res.status(404).json({error:'Planning route not found.'});});
  return router;
}

export async function readPlanning(url:string,owner:string,today:string,zone:string,weekStart:'monday'|'sunday'='monday'){
  const db=await pool(url).connect();try{return await loadPlanning(db,owner,today,zone,weekStart);}finally{db.release();}
}
