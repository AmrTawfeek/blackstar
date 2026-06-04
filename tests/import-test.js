const vm=require('vm'),fs=require('fs'),path=require('path');
const DIR=''+require('path').join(__dirname,'..')+'';
const app=fs.readFileSync(path.join(DIR,'app.js'),'utf8');
const pages=fs.readFileSync(path.join(DIR,'pages.js'),'utf8');
function fakeEl(){const e={style:{},dataset:{},classList:{add(){},remove(){},contains(){return false}},setAttribute(){},getAttribute(){return null},removeAttribute(){},appendChild(c){return c},addEventListener(){},remove(){},querySelector(){return fakeEl()},querySelectorAll(){return[]}};return e;}
const ds={getElementById(){return fakeEl()},querySelector(){return fakeEl()},querySelectorAll(){return[]},createElement(){return fakeEl()},addEventListener(){},body:fakeEl(),head:fakeEl(),documentElement:fakeEl()};
const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{userAgent:'n'},location:{href:'x',reload(){}},document:ds,matchMedia:()=>({matches:false,addEventListener(){}})};
ctx.window=ctx;ctx.globalThis=ctx;ctx.window.addEventListener=()=>{};
vm.createContext(ctx);
vm.runInContext(app+'\n;\n'+pages+'\n;this.__imp=importMembers;',ctx,{filename:'c.js'});
const sheets={ 'Members':[
  ['Name En','Coach','Activity','Status','Start Date','Expiry Date','Classes','Paid Amount'],
  ['John Doe','Abdel Salam','Boxing','Expired','2026-04-01','2026-05-01','8','300'],
  ['John Doe','Abdel Salam','Boxing','Active','2026-06-01','2026-07-01','8','300'],
  ['John Doe','Abdel Salam','MMA','Active','2026-06-01','2026-07-01','8','350'],
]};
const res=ctx.__imp(sheets);
const m=res.members[0];
const boxing=m.enrollments.filter(e=>e.sport==='Boxing');
console.log('members:',res.members.length);
console.log('enrollments:',m.enrollments.map(e=>e.sport+'('+e.start+')').join(', '));
console.log('Boxing enrollments (want 1):',boxing.length);
console.log('kept Boxing start (want 2026-06-01 = Active):',boxing[0]&&boxing[0].start);
console.log('subs kept as history (want 3):',m.subscriptions.length);
console.log('dupSportMerged (want 1):',res.summary.duplicateSportsMerged);
console.log('warning:',res.warnings.find(w=>w.includes('duplicate sport'))||'(none)');
