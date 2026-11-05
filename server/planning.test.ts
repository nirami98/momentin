import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, habitPlanSchema, scheduled, statusOn, streaks, taskStatus, taskOccurrences, type PlannedHabit, type Task } from '../shared/planning.js';
const plan=habitPlanSchema.parse({title:'Read',category:'Learning',target:20,unit:'pages'});
const habit:PlannedHabit={id:'h',start:'2026-10-28',versions:[{effective:'2026-10-28',plan}]};
test('prospective schedules and targets leave historical completion unchanged',()=>{
  const h={...habit,versions:[...habit.versions,{effective:'2026-11-01',plan:{...plan,target:30,schedule:{...plan.schedule,kind:'weekdays' as const,weekdays:[1,3,5]}}}]};
  const e=[{habitId:'h',date:'2026-10-31',value:20,fallback:false}];
  assert.equal(statusOn(h,'2026-10-31',e,'2026-11-04'),'completed');
  assert.equal(scheduled(h,'2026-11-01'),false);
  assert.equal(scheduled(h,'2026-11-02'),true);
  assert.equal(statusOn(h,'2026-11-02',[{...e[0],date:'2026-11-02'}],'2026-11-04'),'partial');
});
test('freezes protect only existing overall streaks, reset monthly, and do not increase count',()=>{
  const entries=[{habitId:'h',date:'2026-10-28',value:20,fallback:false}];
  const s=streaks([habit],entries,'2026-11-02');
  assert.deepEqual(s.freezes,['2026-10-29','2026-10-30']);
  assert.equal(s.current,0);assert.equal(s.longest,1);assert.equal(s.remaining,2);
  const rollover=streaks([{...habit,start:'2026-10-30'}],[{...entries[0],date:'2026-10-30'}],'2026-11-03');
  assert.deepEqual(rollover.freezes,['2026-10-31','2026-11-01','2026-11-02']);
  assert.equal(rollover.current,1);assert.equal(rollover.remaining,0);
});
test('partial work and fallback do not earn streak credit; all-paused days use freezes',()=>{
  const h={...habit,versions:[...habit.versions,{effective:'2026-10-29',plan:{...plan,paused:true}}]};
  const s=streaks([h],[{habitId:'h',date:'2026-10-28',value:20,fallback:false}],'2026-10-31');
  assert.equal(s.current,1);assert.equal(s.individual.h,0);assert.equal(s.freezes.length,2);
  assert.equal(streaks([habit],[{habitId:'h',date:'2026-10-28',value:10,fallback:false}],'2026-10-29').current,0);
  assert.equal(streaks([habit],[{habitId:'h',date:'2026-10-28',value:20,fallback:true}],'2026-10-29').current,0);
});
test('weekly consistency counts completed weeks and respects week start',()=>{
  const h={...habit,start:'2026-11-02',versions:[{effective:'2026-11-02',plan:{...plan,schedule:{...plan.schedule,kind:'weekly' as const,times:2}}}]};
  const entries=['2026-11-02','2026-11-04'].map(date=>({habitId:'h',date,value:20,fallback:false}));
  assert.equal(streaks([h],entries,'2026-11-09','monday').individual.h,1);
});
test('task deadline remains overdue for five complete days, and late completion retains its date',()=>{
  const task={due:'2026-10-12',repeatDays:7,completions:{}} as Task;
  assert.equal(taskStatus(task,'2026-10-12','2026-10-17'),'overdue');
  assert.equal(taskStatus(task,'2026-10-12','2026-10-18'),'missed');
  task.completions['2026-10-12']={date:'2026-10-19',subtasks:[]};
  assert.equal(taskStatus(task,'2026-10-12','2026-10-20'),'completed late');
  assert.deepEqual(taskOccurrences(task,'2026-10-12','2026-10-27'),['2026-10-12','2026-10-19','2026-10-26']);
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
