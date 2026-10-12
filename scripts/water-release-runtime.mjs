import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const endpoint=process.env.WB_CDP_ENDPOINT || "http://127.0.0.1:9238";
const expected=process.env.WB_CDP_VAULT_ROOT;
const output=process.env.WB_RUNTIME_OUTPUT;
if(!expected || !output) throw new Error("Explicit isolated Vault and output directory required");
await fs.mkdir(output,{recursive:true});
const targets=await fetch(`${endpoint}/json/list`).then(r=>r.json());
const ws=new WebSocket(targets.find(t=>t.type==="page" && t.url==="app://obsidian.md/index.html").webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
let nextId=1;const pending=new Map();const errors=[];
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==="Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text);});
function call(method,params={}){const id=nextId++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timed out: ${method}`)),15000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(new Error(m.error.message)):resolve(m.result);});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(fn,arg){const result=await call("Runtime.evaluate",{expression:`(${fn.toString()})(${JSON.stringify(arg)})`,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await call("Runtime.enable");await call("Page.enable");
const vault=await evaluate(()=>app.vault.adapter.basePath);
assert.equal(path.resolve(vault),path.resolve(expected),"Refusing to operate on an unregistered Vault");
const report={kind:"whiteboat-water-release-runtime",vault,recordedAt:new Date().toISOString(),cases:[],errors};
async function screenshot(name){const capture=await call("Page.captureScreenshot",{format:"png"});await fs.writeFile(path.join(output,name),Buffer.from(capture.data,"base64"));}
try{
 await evaluate(()=>{const trust=[...document.querySelectorAll(".modal-container")].find(m=>m.textContent.includes("你是否信任这个仓库"));const button=[...trust?.querySelectorAll("button")||[]].find(b=>b.textContent==="信任仓库作者并启用插件");button?.click();});await sleep(500);
 await evaluate(async()=>{await app.plugins.unloadPlugin("whiteboat");});
 for(let i=0;i<40;i++){if(await evaluate(()=>document.querySelectorAll(".whiteboat-canvas-entry:not(.is-settings-preview)").length===0))break;await sleep(100);}
 await evaluate(async()=>{await app.plugins.loadPlugin("whiteboat");document.body.classList.remove("theme-dark");document.body.classList.add("theme-light");});
 for(let i=0;i<40;i++){if(await evaluate(()=>!!app.plugins.plugins.whiteboat?.entry && document.querySelectorAll(".whiteboat-canvas-entry:not(.is-settings-preview)").length===1))break;await sleep(100);}
 const startup=await evaluate(()=>({loaded:!!app.plugins.plugins.whiteboat,commands:Object.keys(app.commands.commands).filter(id=>id.startsWith("whiteboat:")),home:document.querySelectorAll(".whiteboat-canvas-entry:not(.is-settings-preview)").length,files:app.vault.getFiles().map(f=>f.path)}));
 assert.equal(startup.loaded,true);assert.deepEqual(startup.commands,["whiteboat:open-canvas-creation-entry"]);assert.equal(startup.home,1);const baselineFiles=startup.files;
 const baselineEmpty=await evaluate(async()=>{const files=app.vault.getFiles().filter(f=>f.extension==="canvas");const data=await Promise.all(files.map(async f=>JSON.parse(await app.vault.read(f))));return data.filter(c=>c.nodes.length===0&&c.edges.length===0).length;});
 await screenshot("desktop-light-water.png");report.cases.push({name:"startup-water-only",...startup});
 const audio=await evaluate(()=>{const sound=app.plugins.plugins.whiteboat.entry.soundscape;return {snapshot:sound.getSnapshot(),loaded:sound.howl?.state(),playing:sound.howl?.playing(),loop:sound.howl?._loop};});
 assert.notEqual(audio.snapshot.state,"error");assert.equal(audio.loaded,"loaded");assert.equal(audio.loop,false); // Core restarts at onend instead of Howler native looping.
 await evaluate(()=>app.plugins.plugins.whiteboat.entry.soundscape.setEnabled(false));await sleep(250);
 const muted=await evaluate(()=>app.plugins.plugins.whiteboat.entry.soundscape.getSnapshot());assert.equal(muted.state,"muted");
 await evaluate(()=>app.plugins.plugins.whiteboat.entry.soundscape.setEnabled(true));await sleep(600);
 report.cases.push({name:"real-bundled-audio-load-and-mute",audio,muted,proof:"playback state only; listening acceptance pending"});
 await evaluate(()=>{app.plugins.plugins.whiteboat.openWater();app.plugins.plugins.whiteboat.openWater();});
 assert.equal(await evaluate(()=>document.querySelectorAll(".whiteboat-canvas-entry:not(.is-settings-preview)").length),1);
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:550,clientY:360})));
 await sleep(900);
 const composer=await evaluate(()=>{const el=document.querySelector(".whiteboat-canvas-entry__idea");el.value="一片水面，写下中文想法 🌊";el.dispatchEvent(new Event("input",{bubbles:true}));return {open:document.querySelectorAll(".whiteboat-canvas-entry__composer.is-open").length,focused:document.activeElement===el};});
 assert.equal(composer.open,1);
 await screenshot("desktop-light-composer.png");
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__idea").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
 await sleep(300);
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:600,clientY:380})));
 await sleep(750);
 assert.equal(await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__idea").value),"一片水面，写下中文想法 🌊");
 await evaluate(()=>{const form=document.querySelector(".whiteboat-canvas-entry__composer");form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
 for(let i=0;i<40;i++){if(await evaluate(()=>document.querySelectorAll(".whiteboat-canvas-entry").length===0))break;await sleep(200);}
 const created=await evaluate(async()=>{const files=app.vault.getFiles().filter(f=>f.extension==="canvas").sort((a,b)=>b.stat.ctime-a.stat.ctime);return {count:files.length,path:files[0]?.path,data:files[0]?JSON.parse(await app.vault.read(files[0])):null,type:app.workspace.getMostRecentLeaf()?.view.getViewType(),home:document.querySelectorAll(".whiteboat-canvas-entry").length};});
 assert.equal(created.count,baselineFiles.length+1);assert.equal(created.data.nodes[0].text,"一片水面，写下中文想法 🌊");assert.equal(created.data.nodes[0].type,"text");assert.deepEqual(created.data.edges,[]);assert.equal(created.type,"canvas");assert.equal(created.home,0);
 await screenshot("native-canvas-result.png");report.cases.push({name:"draft-escape-and-single-native-canvas",...created});
 await evaluate(()=>{app.plugins.plugins.whiteboat.openWater();});await sleep(300);
 const before=await evaluate(()=>app.vault.getFiles().length);
 await evaluate(()=>app.plugins.plugins.whiteboat.onunload());await sleep(600);
 const unloaded=await evaluate(()=>({home:document.querySelectorAll(".whiteboat-canvas-entry").length,files:app.vault.getFiles().length,classes:document.body.classList.contains("whiteboat-canvas-entry-open"),playing:window.Howler?window.Howler._howls.filter(h=>h.playing()).length:null}));
 assert.equal(unloaded.home,0);assert.equal(unloaded.files,before);assert.equal(unloaded.classes,false);if(unloaded.playing!==null) assert.equal(unloaded.playing,0);
 report.cases.push({name:"unload-does-not-write-or-leave-water",...unloaded});
 // Reload only this explicitly isolated release profile, then exercise dark/reduced-motion.
 await evaluate(async()=>{await app.plugins.unloadPlugin("whiteboat");await app.plugins.loadPlugin("whiteboat");app.vault.setConfig("theme","obsidian");document.body.classList.remove("theme-light");document.body.classList.add("theme-dark");});
 await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});await sleep(500);
 await evaluate(()=>{app.plugins.plugins.whiteboat.openWater();});await sleep(300);
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:550,clientY:360})));
 await sleep(300);
 const dark=await evaluate(()=>({theme:document.body.classList.contains("theme-dark"),reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,home:document.querySelectorAll(".whiteboat-canvas-entry").length,composer:document.querySelectorAll(".whiteboat-canvas-entry__composer.is-open").length,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.equal(dark.theme,true);assert.equal(dark.reduced,true);assert.equal(dark.composer,1);assert.equal(dark.overflow,false);await screenshot("desktop-dark-reduced-composer.png");report.cases.push({name:"dark-and-reduced-motion",...dark});
 await evaluate(()=>{const el=document.querySelector(".whiteboat-canvas-entry__idea");el.value="";document.querySelector(".whiteboat-canvas-entry__composer").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});await sleep(800);
 const empty=await evaluate(async()=>{const files=app.vault.getFiles().filter(f=>f.extension==="canvas");const contents=await Promise.all(files.map(async f=>JSON.parse(await app.vault.read(f))));return {count:files.length,empty:contents.filter(c=>c.nodes.length===0&&c.edges.length===0).length};});
 assert.equal(empty.count,baselineFiles.length+2);assert.equal(empty.empty,baselineEmpty+1);report.cases.push({name:"blank-entry-native-canvas",...empty});
 assert.deepEqual(errors,[]);report.status="passed";
} catch(error){report.status="failed";report.failure=error.stack;throw error;} finally {await fs.writeFile(path.join(output,"runtime.json"),JSON.stringify(report,null,2)+"\n");await call("Emulation.setEmulatedMedia",{features:[]}).catch(()=>{});ws.close();}
console.log(JSON.stringify(report));
