// Compare priority changes in one frozen host state so pointer motion cannot skew geometry.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const endpoint=process.env.WB_CDP_ENDPOINT;
const expected=process.env.WB_CDP_VAULT_ROOT;
const output=process.env.WB_RUNTIME_OUTPUT;
const baselineCss=process.env.WB_BASELINE_CSS;
if(!endpoint || !expected || !output || !baselineCss) throw new Error("Explicit isolated endpoint, Vault, baseline CSS and output required");
await fs.mkdir(output,{recursive:true});
const targets=await fetch(endpoint+'/json/list').then(r=>r.json());const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url==='app://obsidian.md/index.html').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m);pending.delete(m.id)});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(new Error('timeout '+method)),20000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(new Error(m.error.message)):resolve(m.result)});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async(fn,arg)=>{const r=await call('Runtime.evaluate',{expression:`(${fn})(${JSON.stringify(arg)})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
const css={old:await fs.readFile(baselineCss,'utf8'),candidate:await fs.readFile("styles.css",'utf8')};
assert.equal(await evaluate(()=>app.vault.adapter.basePath),expected);
await call('Emulation.setFocusEmulationEnabled',{enabled:true});const records=[];
try {
 for(const name of ['', 'Minimal','Cupertino'])for(const dark of [false,true])for(const narrow of [false,true]) {
  await call('Emulation.setDeviceMetricsOverride',{width:narrow?480:1024,height:800,deviceScaleFactor:1,mobile:false});
  await evaluate(async({name,dark})=>{await app.customCss.readThemes();app.customCss.setTheme(name);require('electron').webFrame.setZoomFactor(1);document.body.classList.toggle('theme-dark',dark);document.body.classList.toggle('theme-light',!dark);await app.plugins.unloadPlugin('whiteboat');await app.plugins.loadManifests();await app.plugins.loadPlugin('whiteboat');await app.plugins.plugins.whiteboat.updateLanguage('auto');}, {name,dark});
  await new Promise(r=>setTimeout(r,400));
  await evaluate(()=>{document.querySelector('.whiteboat-canvas-entry__water').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:240,clientY:350}));});
  await new Promise(r=>setTimeout(r,700));
  await evaluate(async()=>{await Promise.all(document.querySelector(".whiteboat-canvas-entry-modal").getAnimations().map(a=>a.finished.catch(()=>{})));document.querySelector(".whiteboat-canvas-entry-modal").getAnimations().forEach(a=>a.cancel());});
  const result=await evaluate(css=>{
   const owned=[...document.querySelectorAll('style')].filter(s=>s.textContent.includes('WB-ENTRY-006')||s.textContent.includes('whiteboat-entry-moonlight-drift'));
   const sheets=owned.map(s=>[s,s.sheet.disabled]);sheets.forEach(([s])=>s.sheet.disabled=true);
   const style=document.createElement('style');document.head.append(style);
   const selectors=['.whiteboat-canvas-entry-modal-container','.whiteboat-canvas-entry-modal','.whiteboat-canvas-entry','.whiteboat-canvas-entry__header','.whiteboat-canvas-entry__water','.whiteboat-canvas-entry__composer','.whiteboat-canvas-entry__composer-surface','.whiteboat-canvas-entry__composer-body','.whiteboat-canvas-entry__idea','.whiteboat-canvas-entry__shortcut','.whiteboat-canvas-entry__shortcut button','.whiteboat-canvas-entry__command-key'];
   const read=()=>selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {selector,rect:{x:r.x,y:r.y,width:r.width,height:r.height},style:Object.fromEntries(['display','position','visibility','backgroundColor','color','fontSize','fontFamily','whiteSpace','padding','margin','boxSizing','borderWidth','borderRadius','boxShadow','outline','height','width','minWidth','maxWidth','minHeight','maxHeight','opacity','transform','filter','overflow','transitionDuration'].map(k=>[k,s[k]]))}}));
   try {style.textContent=css.old;const before=read();style.textContent=css.candidate;const after=read();return {before,after};}
   finally {style.remove();sheets.forEach(([s,disabled])=>s.sheet.disabled=disabled);}
  },css);
  const differences=[];for(let i=0;i<result.before.length;i++)for(const key of ['rect','style'])if(JSON.stringify(result.before[i][key])!==JSON.stringify(result.after[i][key]))differences.push({selector:result.before[i].selector,key,before:result.before[i][key],after:result.after[i][key]});
  records.push({theme:name||'default',dark,narrow,compared:result.before.length,differences});
 }
 await fs.writeFile(output+"/css-equivalence.json",JSON.stringify({records,passed:records.every(r=>!r.differences.length)},null,2));
 console.log(JSON.stringify(records.map(r=>({theme:r.theme,dark:r.dark,narrow:r.narrow,differences:r.differences})),null,2));
 assert.ok(records.every(r=>!r.differences.length),'CSS differs in a frozen host state');
}finally{await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await evaluate(()=>{app.customCss.setTheme('');require('electron').webFrame.setZoomFactor(1)}).catch(()=>{});ws.close();}
