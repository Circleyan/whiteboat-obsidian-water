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
await call("Page.bringToFront");await call("Emulation.setFocusEmulationEnabled",{enabled:true});
const vault=await evaluate(()=>app.vault.adapter.basePath);
assert.equal(path.resolve(vault),path.resolve(expected),"Refusing to operate on an unregistered Vault");
const report={kind:"whiteboat-water-i18n-runtime",vault,recordedAt:new Date().toISOString(),cases:[],errors};
async function screenshot(name){const capture=await call("Page.captureScreenshot",{format:"png"});await fs.writeFile(path.join(output,name),Buffer.from(capture.data,"base64"));}
try {
 await evaluate(() => { const trust = [...document.querySelectorAll(".modal-container")].find(m => m.textContent.includes("你是否信任这个仓库")); [...trust?.querySelectorAll("button") || []].find(b => b.textContent === "信任仓库作者并启用插件")?.click(); });
 await sleep(500);
 await evaluate(async () => { await app.plugins.unloadPlugin("whiteboat"); await app.plugins.loadPlugin("whiteboat"); await app.plugins.plugins.whiteboat.updateLanguage("auto"); app.setting.close(); });
 const fixture=await evaluate(async()=>{
   const plugin=app.plugins.plugins.whiteboat;
   const data=plugin.savedData;
   data.canvas={...data.canvas,creation:{...data.canvas?.creation,defaultFolder:"随手画布"}};
   delete data.canvas.creation.defaultFolderMode;
   await plugin.saveData(data);
   const fixturePath="随手画布/i18n-existing.canvas";
   const content=JSON.stringify({nodes:[{id:"existing",type:"text",text:"已有内容不移动",x:0,y:0,width:200,height:100}],edges:[]});
   if(!app.vault.getAbstractFileByPath("随手画布"))await app.vault.createFolder("随手画布");
   if(!app.vault.getAbstractFileByPath(fixturePath))await app.vault.create(fixturePath,content);
   return {path:fixturePath,content:await app.vault.read(app.vault.getAbstractFileByPath(fixturePath))};
 });
 for (let i=0; i<40; i++) { if(await evaluate(() => !!app.plugins.plugins.whiteboat?.entry)) break; await sleep(100); }
 const initial = await evaluate(() => ({ preference: app.plugins.plugins.whiteboat.languagePreference, language: app.plugins.plugins.whiteboat.language, folder: app.plugins.plugins.whiteboat.preferences.defaultFolder }));
 assert.equal(initial.preference,"auto");
 assert.ok(["en","zh-CN","zh-TW"].includes(initial.language));
 report.cases.push({ name:"initial-host-language", ...initial });
 await evaluate(() => document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:550,clientY:360})));
 await sleep(900);
 await evaluate(() => {
   const plugin=app.plugins.plugins.whiteboat;
   const entry=plugin.entry;
   const input=document.querySelector(".whiteboat-canvas-entry__idea");
   input.value="保留我的想法 🌊";
   input.dispatchEvent(new Event("input",{bubbles:true}));
   window.__waterLanguageTest={entry,input,water:entry.waterField,boat:entry.boatRenderer,sound:entry.soundscape};
 });
 const titles = { en:"Drop a thought", "zh-CN":"投入想法", "zh-TW":"投入想法" };
 const folders = { en:"Canvases", "zh-CN":"随手画布", "zh-TW":"隨手畫布" };
 assert.equal(initial.folder,folders[initial.language]);
 const placeholders = { en:"What is on your mind?", "zh-CN":"随便说说，你想到什么了？", "zh-TW":"隨意說說，你想到什麼了？" };
 for (const language of ["en","zh-CN","zh-TW"]) {
   await evaluate(async language => await app.plugins.plugins.whiteboat.updateLanguage(language),language);
   const result=await evaluate(() => {
     const old=window.__waterLanguageTest;const plugin=app.plugins.plugins.whiteboat;const entry=plugin.entry;
     const root=document.querySelector(".whiteboat-canvas-entry");
     return { language:plugin.language, sameEntry:entry===old.entry, sameInput:root.querySelector("textarea")===old.input, sameWater:entry.waterField===old.water, sameBoat:entry.boatRenderer===old.boat, sameSound:entry.soundscape===old.sound, draft:old.input.value, focused:document.activeElement===old.input, title:root.querySelector("label").textContent, placeholder:old.input.placeholder, copy:[...root.querySelectorAll("button,[aria-label],label,#whiteboat-canvas-entry-boat-label")].map(e=>[e.textContent,e.getAttribute("aria-label")]), folder:plugin.preferences.defaultFolder, command:app.commands.commands["whiteboat:open-canvas-creation-entry"].name, overflow:root.scrollWidth>root.clientWidth };
   });
   assert.equal(result.language,language);assert.equal(result.title,titles[language]);assert.equal(result.placeholder,placeholders[language]);
   for(const key of ["sameEntry","sameInput","sameWater","sameBoat","sameSound","focused"]) assert.equal(result[key],true,key);
   assert.equal(result.draft,"保留我的想法 🌊");assert.equal(result.folder,folders[language]);assert.equal(result.overflow,false);
   if(language==="en") assert.ok(!/[\u3400-\u9fff]/u.test(JSON.stringify(result.copy)));
   await screenshot(`composer-${language}.png`);
   report.cases.push({name:`live-language-${language}`,...result});
 }
 await evaluate(() => { app.plugins.plugins.whiteboat.entry.closeEntryImmediately(); app.setting.open(); app.setting.openTabById("whiteboat"); });
 await sleep(400);
 const settingsTarget=(await fetch(`${endpoint}/json/list`).then(r=>r.json())).find(t=>t.type==="page" && t.title.includes(path.basename(expected)) && t.url === "about:blank");
 assert.ok(settingsTarget,"Native settings window required");
 const settingsWs=new WebSocket(settingsTarget.webSocketDebuggerUrl);
 await new Promise(r=>settingsWs.addEventListener("open",r,{once:true}));
 let settingsId=1;const settingsPending=new Map();
 settingsWs.addEventListener("message",e=>{const m=JSON.parse(e.data);settingsPending.get(m.id)?.(m);settingsPending.delete(m.id);});
 const settingsCall=(method,params={})=>new Promise((resolve,reject)=>{const id=settingsId++;settingsPending.set(id,m=>m.error?reject(new Error(m.error.message)):resolve(m.result));settingsWs.send(JSON.stringify({id,method,params}));});
 const settingsEvaluate=async(fn,arg)=>{const r=await settingsCall("Runtime.evaluate",{expression:`(${fn.toString()})(${JSON.stringify(arg)})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
 for(const language of ["en","zh-CN","zh-TW"]) {
   await settingsEvaluate(language => {
     const select=document.querySelector(".vertical-tab-content select");
     select.value=language;select.dispatchEvent(new Event("change",{bubbles:true}));
   },language);
   await sleep(200);
   const currentLanguage=await evaluate(()=>app.plugins.plugins.whiteboat.language);
   const settings=await settingsEvaluate(() => {
     const root=document.querySelector(".vertical-tab-content");
     return {names:[...root.querySelectorAll(".setting-item-name")].map(e=>e.textContent), descriptions:[...root.querySelectorAll(".setting-item-description")].map(e=>e.textContent), options:[...root.querySelector("select").options].map(o=>({value:o.value,text:o.text})), selected:root.querySelector("select").value, folder:root.querySelector("input[type=text]").value, overflow:root.scrollWidth>root.clientWidth};
   });
   settings.language=currentLanguage;
   assert.equal(settings.language,language);assert.equal(settings.selected,language);assert.equal(settings.names.length,6);
   assert.equal(settings.folder,folders[language]);
   assert.deepEqual(settings.options.map(o=>o.value),["auto","en","zh-CN","zh-TW"]);
   if(language==="en") assert.ok(!/[\u3400-\u9fff]/u.test(JSON.stringify([settings.names,settings.descriptions])));
   assert.equal(settings.overflow,false);
   const capture=await settingsCall("Page.captureScreenshot",{format:"png"});await fs.writeFile(path.join(output,`settings-${language}.png`),Buffer.from(capture.data,"base64"));report.cases.push({name:`native-settings-${language}`,...settings});
 }
 await settingsEvaluate(()=>{const input=document.querySelector(".vertical-tab-content input[type=text]");input.value="我的自定义目录";input.dispatchEvent(new Event("input",{bubbles:true}));});await sleep(200);
 await evaluate(async()=>await app.plugins.plugins.whiteboat.updateLanguage("en"));
 assert.equal(await settingsEvaluate(()=>document.querySelector(".vertical-tab-content input[type=text]").value),"我的自定义目录");
 assert.equal(await evaluate(()=>app.plugins.plugins.whiteboat.preferences.defaultFolder),"我的自定义目录");
 report.cases.push({name:"custom-folder-retained-across-language-change",folder:"我的自定义目录"});
 await settingsEvaluate(()=>{const input=document.querySelector(".vertical-tab-content input[type=text]");input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));});await sleep(200);
 await evaluate(async()=>await app.plugins.plugins.whiteboat.updateLanguage("zh-TW"));
 assert.equal(await settingsEvaluate(()=>document.querySelector(".vertical-tab-content input[type=text]").value),"隨手畫布");
 settingsWs.close();
 await evaluate(() => app.setting.close());
 await evaluate(async()=>{await app.plugins.unloadPlugin("whiteboat");await app.plugins.loadPlugin("whiteboat");});await sleep(600);
 assert.equal(await evaluate(()=>app.plugins.plugins.whiteboat.languagePreference),"zh-TW");
 report.cases.push({name:"manual-language-survives-plugin-reload",language:"zh-TW"});
 await evaluate(async()=>{await app.plugins.plugins.whiteboat.updateLanguage("en");app.plugins.plugins.whiteboat.openWater();});await sleep(250);
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:550,clientY:360})));await sleep(800);
 await evaluate(()=>{
   const plugin=app.plugins.plugins.whiteboat;const vault=app.vault;
   window.__i18nCreateOriginal=vault.create;
   vault.create=async()=>{throw new Error("Test write failure");};
   document.querySelector("textarea").value="原始内容不翻译";
   document.querySelector(".whiteboat-canvas-entry__composer").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
 });
 for(let i=0;i<40;i++){if(await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__status")?.textContent.includes("Creation failed")))break;await sleep(100);}
 const failed=await evaluate(()=>({button:document.querySelector(".whiteboat-canvas-entry__composer button[type=submit]").textContent,status:document.querySelector(".whiteboat-canvas-entry__status").textContent,draft:document.querySelector("textarea").value,notices:[...document.querySelectorAll(".notice")].map(e=>e.textContent)}));
 assert.equal(failed.button,"Retry");assert.match(failed.status,/Creation failed/);assert.equal(failed.draft,"原始内容不翻译");assert.ok(!/[\u3400-\u9fff]/u.test(JSON.stringify([failed.status,failed.notices])));
 await evaluate(()=>{app.vault.create=window.__i18nCreateOriginal;delete window.__i18nCreateOriginal;});
 report.cases.push({name:"english-write-failure-preserves-draft",...failed});
 await evaluate(()=>document.querySelector(".whiteboat-canvas-entry__composer").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 for(let i=0;i<40;i++){if(await evaluate(()=>!document.querySelector(".whiteboat-canvas-entry")))break;await sleep(200);}
 const created=await evaluate(async()=>{const file=app.workspace.getMostRecentLeaf().view.file;return {path:file.path,data:JSON.parse(await app.vault.read(file)),type:app.workspace.getMostRecentLeaf().view.getViewType(),notices:[...document.querySelectorAll(".notice")].map(e=>e.textContent)};});
 assert.equal(created.type,"canvas");assert.equal(created.data.nodes[0].text,"原始内容不翻译");assert.match(created.path,/^Canvases\/.* Canvas\.canvas$/);report.cases.push({name:"english-success-native-canvas-original-input",...created});
 const retained=await evaluate(async fixture=>({path:fixture.path,content:await app.vault.read(app.vault.getAbstractFileByPath(fixture.path))}),fixture);
 assert.deepEqual(retained,fixture);report.cases.push({name:"existing-canvas-path-and-content-unchanged",...retained});
 await evaluate(async()=>{await app.plugins.plugins.whiteboat.updateLanguage("auto");app.plugins.plugins.whiteboat.openWater();delete window.__waterLanguageTest;});
 assert.deepEqual(errors,[]);report.status="passed";
} catch(error){report.status="failed";report.failure=error.stack;throw error;} finally {
 await evaluate(()=>{if(window.__i18nCreateOriginal){app.vault.create=window.__i18nCreateOriginal;delete window.__i18nCreateOriginal;}delete window.__waterLanguageTest;}).catch(()=>{});
 await fs.writeFile(path.join(output,"i18n-runtime.json"),JSON.stringify(report,null,2)+"\n");ws.close();
}
console.log(JSON.stringify(report));
