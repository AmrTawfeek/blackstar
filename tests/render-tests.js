// Render harness — calls every PAGES.x(main) to evaluate all template
// expressions (catches ReferenceErrors / typos in page markup).
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const DIR = '/home/claude/v121fix/blackstars-localhost';
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(DIR, 'pages.js'), 'utf8');

const noopCtx = new Proxy({}, { get: () => (() => noopCtx) });
function fakeEl() {
  const e = {
    style: {}, dataset: {}, _html: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    setAttribute(){}, getAttribute(){return null;}, removeAttribute(){},
    appendChild(c){return c;}, append(){}, prepend(){}, before(){}, after(){},
    addEventListener(){}, removeEventListener(){}, remove(){},
    querySelector(){return fakeEl();}, querySelectorAll(){return [];},
    getContext(){return noopCtx;}, toBlob(){}, toDataURL(){return '';},
    focus(){}, click(){}, closest(){return fakeEl();}, contains(){return false;},
    insertAdjacentHTML(){}, cloneNode(){return fakeEl();}, getBoundingClientRect(){return {width:0,height:0,top:0,left:0};},
    scrollIntoView(){}, scrollTo(){}, hasAttribute(){return false;},
  };
  Object.defineProperty(e,'innerHTML',{get(){return this._html;},set(v){this._html=v;}});
  Object.defineProperty(e,'textContent',{get(){return this._txt||'';},set(v){this._txt=v;}});
  Object.defineProperty(e,'value',{get(){return this._val||'';},set(v){this._val=v;}});
  Object.defineProperty(e,'checked',{get(){return false;},set(){}});
  Object.defineProperty(e,'children',{get(){return [];}});
  Object.defineProperty(e,'firstChild',{get(){return null;}});
  Object.defineProperty(e,'parentNode',{get(){return fakeEl();}});
  return e;
}
const documentStub = {
  getElementById(){return fakeEl();}, querySelector(){return fakeEl();}, querySelectorAll(){return [];},
  createElement(){return fakeEl();}, createElementNS(){return fakeEl();},
  addEventListener(){}, removeEventListener(){}, createDocumentFragment(){return fakeEl();},
  body: fakeEl(), head: fakeEl(), documentElement: fakeEl(),
};
const lsM = {};
const ctx = {
  console, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, requestAnimationFrame:()=>0,
  localStorage:{getItem:k=>k in lsM?lsM[k]:null,setItem:(k,v)=>{lsM[k]=String(v);},removeItem:k=>{delete lsM[k];}},
  navigator:{userAgent:'node',clipboard:{writeText:()=>Promise.resolve()}},
  location:{href:'file:///index.html',reload(){}},
  document: documentStub, alert:()=>{}, confirm:()=>true, prompt:()=>null,
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
  URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}}, Blob:function(){}, FileReader:function(){ this.readAsText=()=>{}; this.readAsDataURL=()=>{}; },
  fetch:()=>Promise.reject(new Error('no net')), Image:function(){},
};
ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.window.addEventListener=()=>{};
vm.createContext(ctx);

const seed = fs.readFileSync('/home/claude/seed-block.js','utf8');

const epilogue = `
${seed}
;(function renderAll(){
  const routes = ['dashboard','members','invoices','attendance','schedule','campschedule','expenses','salaries','products','sales','sports','audit','settings','history','expiring','trials','attreport','enrolled','renewals','coachperf','reports','dataimport','dataexport','rentals','coaches'];
  let okN=0, badN=0; const bad=[];
  for (const r of routes) {
    const fn = (typeof PAGES!=='undefined') && PAGES[r];
    if (!fn) { bad.push(r+' (PAGE MISSING)'); badN++; continue; }
    try {
      const main = (function(){ var x={style:{},_h:''}; Object.defineProperty(x,'innerHTML',{get(){return x._h;},set(v){x._h=v;}}); x.classList={add(){},remove(){},toggle(){}}; x.appendChild=function(){}; x.querySelector=function(){return null;}; x.querySelectorAll=function(){return [];}; x.addEventListener=function(){}; return x; })();
      fn(main);
      okN++;
    } catch(e) {
      badN++; bad.push(r + ' -> ' + (e && e.message));
    }
  }
  console.log('\\n=========== PAGE RENDER RESULTS ===========');
  console.log('Rendered OK: ' + okN + '   Errored: ' + badN);
  if (bad.length){ console.log('\\nERRORS:'); bad.forEach(b=>console.log('  ✗ '+b)); }
  else console.log('All pages rendered without errors ✅');
  console.log('===========================================');
})();
`;

const combined = appSrc + '\n;\n' + pagesSrc + '\n;\n' + epilogue;
try { vm.runInContext(combined, ctx, { filename:'render.js' }); }
catch(e){ console.error('HARNESS ERROR:', e && e.stack ? e.stack.split('\n').slice(0,6).join('\n') : e); process.exit(1); }
