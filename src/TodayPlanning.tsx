import {useEffect,useState} from 'react';
import {planOn,scheduled,statusOn,taskOccurrences,taskStatus} from '../shared/planning';
import type {PlanningSnapshot} from '../server/planning';
export function TodayPlanning({open,timeZone}:{open:()=>void;timeZone:string}){
  const [data,setData]=useState<PlanningSnapshot|null>(null);
  const [now,setNow]=useState(new Date());
  useEffect(()=>{let active=true;void fetch('/api/planning').then(r=>r.ok?r.json():null).then(d=>{if(active)setData(d);}).catch(()=>{});const timer=setInterval(()=>setNow(new Date()),60000);return()=>{active=false;clearInterval(timer);};},[]);
  if(!data||!Array.isArray(data.tasks)||!data.streak)return null;
  const due=data.tasks.filter(t=>!t.archived).flatMap(t=>taskOccurrences(t,t.due,data.today).filter(d=>!t.completions[d]).map(date=>({task:t,date}))).sort((a,b)=>({high:0,normal:1,low:2}[a.task.priority]-{high:0,normal:1,low:2}[b.task.priority])).slice(0,8);
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
  const p=data.preferences;
  const quiet=p.quietStart===p.quietEnd?false:p.quietStart<p.quietEnd?clock>=p.quietStart&&clock<p.quietEnd:clock>=p.quietStart||clock<p.quietEnd;
  const reminders=p.enabled&&!quiet?data.habits.filter(h=>scheduled(h,data.today)&&Boolean(planOn(h,data.today)?.reminder)&&planOn(h,data.today)!.reminder<=clock&&statusOn(h,data.today,data.entries,data.today)!=='completed'):[];
  return <section className="panel today-planning"><div className="section-heading"><h2>Your daily priorities</h2><button className="text-button" onClick={open}>Open planner →</button></div><p>{data.streak.current} day overall streak · {data.streak.remaining} freezes left this month</p>{due.length===0?<p className="muted">No outstanding tasks due today.</p>:due.map(({task,date})=><p key={task.id+date}><strong>{task.title}</strong> · {task.priority} priority · {taskStatus(task,date,data.today)}</p>)}{reminders.map(h=><p className="reminder-list" key={h.id}>Reminder: {planOn(h,data.today)!.title}</p>)}</section>;
}
