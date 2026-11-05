import {test,expect} from '@playwright/test';
const profile={displayName:'Tester',bio:'',interests:'',timeZone:'UTC',weekStart:'monday',units:'metric',theme:'light',palette:'mint',reducedMotion:false,sound:false,avatarFileId:null,ageConfirmed:true};
const today='2026-11-05';
const plan={title:'Read',category:'Learning',target:20,unit:'pages',measurement:'count',tags:['books'],schedule:{kind:'daily',weekdays:[1,2,3,4,5],times:3,every:2},paused:false,archived:false,fallback:'Read one page',reminder:'09:00',priority:'normal'};
test('planner creates schedules, shows history, previews publication and navigates account controls',async({page})=>{
  const habits=[{id:'00000000-0000-4000-8000-000000000001',start:today,versions:[{effective:today,plan}]}];
  let created:any=null,published:any=null;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/account-config')return route.fulfill({json:{enabled:true,google:false}});
    if(path==='/api/me')return route.fulfill({json:{user:{id:'user',email:'tester@example.test',name:'Tester'},profile}});
    if(path==='/api/habits')return route.fulfill({json:{date:today,timeZone:'UTC',habits:[]}});
    if(path==='/api/files')return route.fulfill({json:{files:[]}});
    if(path==='/api/planning/habits'){created=route.request().postDataJSON();return route.fulfill({json:{id:'new-habit'}});}
    if(path==='/api/planning/templates'&&route.request().method()==='POST'){published=route.request().postDataJSON();return route.fulfill({json:{id:'template'}});}
    if(path==='/api/planning/templates'||path==='/api/planning/reports')return route.fulfill({json:[]});
    if(path==='/api/planning')return route.fulfill({json:{today,habits,entries:[{habitId:habits[0].id,date:today,value:10,fallback:false}],tasks:[],goals:[],annotations:[],preferences:{enabled:false,quietStart:'22:00',quietEnd:'08:00'},streak:{current:0,longest:0,freezes:[],remaining:2,individual:{}},admin:true}});
    return route.fulfill({status:404,json:{error:'Not found'}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Plan and history',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your plan.'})).toBeVisible();
  await page.getByRole('button',{name:'Create a scheduled habit'}).click();
  await page.getByLabel('Habit name',{exact:true}).fill('Walk');
  await page.getByRole('combobox',{name:'Schedule',exact:true}).selectOption('weekdays');
  await page.getByLabel('Sat',{exact:true}).check();
  await page.getByRole('button',{name:'Save habit',exact:true}).click();
  await expect.poll(()=>created?.schedule.kind).toBe('weekdays');
  expect(created.schedule.weekdays).toContain(6);
  await page.getByRole('button',{name:'History',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Add a dated annotation'})).toBeVisible();
  await expect(page.getByText('partial · 10/20 pages')).toBeVisible();
  await page.getByRole('button',{name:'Templates',exact:true}).click();
  await page.getByLabel('Template name',{exact:true}).fill('My reading routine');
  await page.getByRole('group',{name:'Include habits'}).getByRole('checkbox').check();
  await page.getByLabel('Publish for other members to discover').check();
  await page.getByRole('button',{name:'Preview template'}).click();
  await expect(page.getByRole('heading',{name:'Template preview'})).toBeVisible();
  expect(published).toBeNull();
  await page.getByRole('button',{name:'Confirm publication'}).click();
  await expect.poll(()=>published?.title).toBe('My reading routine');
  expect(published.habits[0].title).toBe('Read');
  expect(published.habits[0].value).toBeUndefined();
  await page.getByRole('button',{name:'Moderation',exact:true}).click();
  await expect(page.getByText('No open reports.')).toBeVisible();
  await page.getByRole('button',{name:'Your account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Show active sessions'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Download my data'})).toBeVisible();
});
test('mobile planner tabs and calendar stay within the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/account-config')return route.fulfill({json:{enabled:true,google:false}});
    if(path==='/api/me')return route.fulfill({json:{user:{id:'user',email:'tester@example.test',name:'Tester'},profile}});
    if(path==='/api/habits')return route.fulfill({json:{date:today,timeZone:'UTC',habits:[]}});
    return route.fulfill({json:{today,habits:[],entries:[],tasks:[],goals:[],annotations:[],preferences:{enabled:false,quietStart:'22:00',quietEnd:'08:00'},streak:{current:0,longest:0,freezes:[],remaining:2,individual:{}},admin:false}});
  });
  await page.goto('/');await page.getByRole('button',{name:'Plan and history'}).click();
  await page.getByRole('button',{name:'History',exact:true}).click();
  await page.getByLabel('Calendar view').selectOption('month');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/momentin-planner-mobile.png',fullPage:true});
});
