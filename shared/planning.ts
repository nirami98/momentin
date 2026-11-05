import { z } from 'zod';
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
export const scheduleSchema = z.object({
  weekStart: z.enum(['monday','sunday']).optional(),
  kind: z.enum(['daily', 'weekdays', 'weekly', 'interval']).default('daily'),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([1,2,3,4,5]),
  times: z.number().int().min(1).max(7).default(3),
  every: z.number().int().min(1).max(365).default(2),
}).strict().refine(s => s.kind !== 'weekdays' || s.weekdays.length > 0, 'Choose at least one weekday.');
export type Schedule = z.infer<typeof scheduleSchema>;
export const habitPlanSchema = z.object({
  title: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(30),
  target: z.number().positive().max(100000), unit: z.string().trim().min(1).max(20),
  measurement: z.enum(['checkbox', 'count', 'duration', 'number']).default('count'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  schedule: scheduleSchema.default({kind:'daily',weekdays:[1,2,3,4,5],times:3,every:2}),
  paused: z.boolean().default(false), archived: z.boolean().default(false),
  fallback: z.string().trim().max(200).default(''),
  reminder: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/).default(''),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
}).strict().refine(h => h.measurement !== 'checkbox' || h.target === 1, 'Checkbox habits have a daily goal of 1.')
.refine(h => h.measurement !== 'count' || Number.isInteger(h.target), 'Counts use whole numbers.');
export type HabitPlan = z.infer<typeof habitPlanSchema>;
export type PlannedHabit = {id:string; start:string; versions:{effective:string; plan:HabitPlan}[]};
export type Entry = {habitId:string; date:string; value:number; fallback:boolean};
export const taskSchema = z.object({
  title:z.string().trim().min(1).max(100), due:daySchema,
  priority:z.enum(['low','normal','high']).default('normal'),
  effort:z.number().int().min(0).max(100000).default(0),
  repeatDays:z.number().int().min(0).max(365).default(0),
  subtasks:z.array(z.string().trim().min(1).max(150)).max(30).default([]),
  category:z.string().max(30).default('Personal'), tags:z.array(z.string().max(30)).max(10).default([]),
  archived:z.boolean().default(false),
}).strict();
export type TaskPlan = z.infer<typeof taskSchema>;
export type Task = TaskPlan & {id:string; completions:Record<string,{date:string; subtasks:number[]}>; checks:Record<string,number[]>};
export const goalSchema = z.object({
  title:z.string().trim().min(1).max(100),
  milestones:z.array(z.string().trim().min(1).max(150)).min(1).max(30),
  habitIds:z.array(z.uuid()).max(100).default([]), taskIds:z.array(z.uuid()).max(100).default([]),
  mode:z.enum(['milestones','activities']).default('milestones'),
  target:z.number().int().min(1).max(100000).default(10),
  category:z.string().max(30).default('Personal'), tags:z.array(z.string().max(30)).max(10).default([]),
  archived:z.boolean().default(false),
}).strict();
export type GoalPlan = z.infer<typeof goalSchema>;
export type Goal = GoalPlan & {id:string; achieved:Record<string,string>;start?:string;versions?:{effective:string;plan:GoalPlan}[]};
export function goalOn(goal:Goal,date:string):Goal { const plan=goal.versions?.filter(v=>v.effective<=date).sort((a,b)=>a.effective.localeCompare(b.effective)).at(-1)?.plan;return plan?{...goal,...plan}:goal; }
export function addDays(date:string, count:number) { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10); }
export function daysBetween(a:string,b:string) { return Math.round((Date.parse(b)-Date.parse(a))/86400000); }
export function weekOf(date:string, start:'monday'|'sunday'='monday') { const day=new Date(date+'T12:00:00Z').getUTCDay();return addDays(date,-((day-(start==='monday'?1:0)+7)%7)); }
export function planOn(habit:PlannedHabit,date:string) { return habit.versions.filter(v=>v.effective<=date).sort((a,b)=>a.effective.localeCompare(b.effective)).at(-1)?.plan; }
export function scheduled(habit:PlannedHabit,date:string) {
  const p=planOn(habit,date);
  if(!p||date<habit.start||p.archived||p.paused)return false;
  return p.schedule.kind==='weekdays'?p.schedule.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay()):
    p.schedule.kind==='interval'?daysBetween(habit.start,date)%p.schedule.every===0:true;
}
export function statusOn(h:PlannedHabit,date:string,entries:Entry[],today:string) {
  const p=planOn(h,date), e=entries.find(e=>e.habitId===h.id&&e.date===date);
  if(e && p && e.value>=p.target && !e.fallback)return 'completed';
  if(e?.fallback)return 'fallback';
  if(e&&e.value>0)return 'partial';
  if(p?.paused)return 'paused';
  if(!scheduled(h,date))return 'not scheduled';
  if(p?.schedule.kind==='weekly')return date<today?'not logged':'available';
  return date<today?'missed':'pending';
}
export function streaks(habits:PlannedHabit[],entries:Entry[],today:string,weekStart:'monday'|'sunday'='monday') {
  const start=habits.map(h=>h.start).sort()[0]??today;
  let current=0,longest=0,month='',used=0;
  const freezes:string[]=[];
  for(let d=start;d<=today;d=addDays(d,1)){
    if(d.slice(0,7)!==month){month=d.slice(0,7);used=0;}
    const complete=habits.some(h=>statusOn(h,d,entries,today)==='completed');
    if(complete){current++;longest=Math.max(longest,current);}
    else if(d<today){if(current>0&&used<2){used++;freezes.push(d);}else current=0;}
  }
  const individual:Record<string,number>={};
  for(const h of habits){
    let count=0;
    for(let d=h.start;d<=today;d=addDays(d,1)){
      const p=planOn(h,d);if(!p)continue;
      if(p.schedule.kind==='weekly'){
        const boundary=p.schedule.weekStart??weekStart;
        if(d!==addDays(weekOf(d,boundary),6)||d>=today)continue;
        const first=weekOf(d,boundary);
        const n=entries.filter(e=>e.habitId===h.id&&e.date>=first&&e.date<=d&&statusOn(h,e.date,entries,today)==='completed').length;
        count=n>=p.schedule.times?count+1:0;
      }else if(statusOn(h,d,entries,today)==='completed')count++;
      else if(d<today&&(scheduled(h,d)||p.paused))count=0;
    }
    individual[h.id]=count;
  }
  return {current,longest,freezes,remaining:2-used,individual};
}
export function taskOccurrences(task:Task,from:string,to:string) {
  const dates:string[]=[];
  for(let d=task.due;d<=to;d=addDays(d,task.repeatDays)){
    if(d>=from)dates.push(d);
    if(!task.repeatDays)break;
  }
  return dates;
}
export function taskStatus(task:Task,due:string,today:string) {
  const c=task.completions[due];
  if(c)return c.date>due?'completed late':'completed';
  return today>addDays(due,5)?'missed':today>due?'overdue':'pending';
}
export function goalProgress(goal:Goal,habits:PlannedHabit[],entries:Entry[],tasks:Task[],today:string) {
  goal=goalOn(goal,today);
  if(goal.mode==='milestones')return {value:Object.values(goal.achieved).filter(date=>date<=today).length,target:goal.milestones.length};
  const value=entries.filter(e=>e.date<=today&&goal.habitIds.includes(e.habitId)&&habits.some(h=>h.id===e.habitId&&statusOn(h,e.date,entries,today)==='completed')).length
    + tasks.filter(t=>goal.taskIds.includes(t.id)).reduce((n,t)=>n+Object.values(t.completions).filter(c=>c.date<=today).length,0);
  return {value,target:goal.target};
}
