import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const endpoint = process.env.WB_CDP_ENDPOINT;
const vault = process.env.WB_CDP_VAULT_ROOT;
const output = process.env.WB_RUNTIME_OUTPUT;
if (!endpoint || !vault || !output) throw new Error("Explicit isolated endpoint, Vault and output required");
const pages = await fetch(`${endpoint}/json/list`).then(r => r.json());
const socket = new WebSocket(pages.find(p => p.url === "app://obsidian.md/index.html").webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
  else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id, timer = setTimeout(() => reject(Error(`Timeout ${method}`)), 15000);
  pending.set(n, m => { clearTimeout(timer); m.error ? reject(Error(m.error.message)) : resolve(m.result); });
  socket.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (fn, arg) => {
  const r = await call("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { vault, endpoint, checks: [], errors, status: "running" };
const sample = () => ev(() => ({ ...document.querySelector(".whiteboat-canvas-entry:not(.is-settings-preview) .whiteboat-canvas-entry__water-canvas")?.dataset }));
const shot = async name => {
  const r = await call("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(r.data, "base64"));
};
try {
  assert.equal(await ev(() => app.vault.adapter.basePath), vault);
  assert.deepEqual(await ev(() => app.workspace.getLeavesOfType("canvas").map(l => l.view.file?.path ?? null)), []);
  await fs.mkdir(output, { recursive: true });
  await call("Runtime.enable");
  await call("Emulation.setFocusEmulationEnabled", { enabled: true });
  await ev(async () => { app.setting.close(); await app.plugins.unloadPlugin("whiteboat"); await app.plugins.loadPlugin("whiteboat"); });
  await sleep(700);
  await ev(() => { const w = require("@electron/remote").getCurrentWindow(); w.show(); w.focus(); w.moveTop(); app.plugins.plugins.whiteboat.openWater(); });
  const first = await sample(); await sleep(350); const next = await sample();
  assert.equal(next.waterRenderer, "disc-lab-webgl2"); assert.equal(next.waterMode, "5");
  assert.ok(+next.waterFrames > +first.waterFrames);
  report.checks.push({ name: "public-default-original-lab-gpu", first, next });
  await shot("public-water");
  const gpu = await ev(() => { const f = app.plugins.plugins.whiteboat.entry.waterField; f.renderer.clear(0); return f.renderer.probe({ ...f.settings(), dark: true }); });
  assert.equal(gpu.passed, true); assert.equal(gpu.glError, 0);
  report.checks.push({ name: "original-lab-gpu-material-solver-probe", gpu });
  await ev(() => { app.setting.open(); app.setting.openTabById("whiteboat"); }); await sleep(300);
  const settings = await ev(() => { const el = app.setting.activeTab.containerEl; return { text: el.textContent, selects: el.querySelectorAll('select:not([aria-hidden="true"])').length, sliders: el.querySelectorAll('input[type="range"]').length }; });
  assert.equal(settings.selects, 1); assert.equal(settings.sliders, 3);
  assert.ok(!/水面形态|观察方式|圆盘曲率|Water appearance|Observation/u.test(settings.text));
  report.checks.push({ name: "public-settings-no-experimental-appearance", settings });
  await ev(() => app.setting.close());
  await ev(() => app.plugins.plugins.whiteboat.entry.openComposer({ point: { x: 450, y: 300 }, focus: true }));
  await sleep(720);
  assert.equal((await sample()).flowScale, "0");
  await ev(() => { app.plugins.plugins.whiteboat.entry.ideaEl.value = "保留草稿\n第二行"; app.plugins.plugins.whiteboat.entry.closeComposer(); });
  await sleep(300); assert.equal((await sample()).flowScale, "1");
  await ev(() => app.plugins.plugins.whiteboat.entry.openComposer({ point: { x: 650, y: 350 }, focus: true }));
  await sleep(700);
  assert.equal(await ev(() => app.plugins.plugins.whiteboat.entry.ideaEl.value), "保留草稿\n第二行");
  report.checks.push({ name: "composer-core-timing-and-draft" });
  await ev(() => { app.plugins.plugins.whiteboat.entry.closeComposer(); window.__wbResize = require("@electron/remote").getCurrentWindow().getSize(); });
  await sleep(300);
  for (const size of [[720, 580], [1200, 780], [840, 660]]) {
    await ev(size => require("@electron/remote").getCurrentWindow().setSize(...size), size); await sleep(180);
    assert.equal((await sample()).waterState, "running");
    assert.equal(await ev(() => app.plugins.plugins.whiteboat.entry.waterField.renderer.gl.getError()), 0);
  }
  await ev(() => require("@electron/remote").getCurrentWindow().setSize(...window.__wbResize));
  report.checks.push({ name: "native-window-resize-keeps-gpu-painted" });
  await ev(() => app.plugins.plugins.whiteboat.entry.waterField.setReducedMotion(true)); await sleep(100);
  const still = await sample(); await sleep(250); assert.equal((await sample()).waterFrames, still.waterFrames);
  await ev(() => app.plugins.plugins.whiteboat.entry.waterField.setReducedMotion(false));
  report.checks.push({ name: "reduced-motion-stops-frame-loop" });
  await ev(() => { document.body.classList.remove("theme-dark"); document.body.classList.add("theme-light"); }); await sleep(200); await shot("public-light");
  await ev(() => { document.body.classList.remove("theme-light"); document.body.classList.add("theme-dark"); });
  report.checks.push({ name: "light-and-dark" });
  await ev(() => { window.__wbLost = app.plugins.plugins.whiteboat.entry.waterField.renderer.gl.getExtension("WEBGL_lose_context"); window.__wbLost.loseContext(); });
  await sleep(100); assert.equal((await sample()).waterState, "context-lost");
  await ev(() => window.__wbLost.restoreContext()); await sleep(600); assert.equal((await sample()).waterState, "running");
  report.checks.push({ name: "real-context-loss-restoration" });
  await ev(() => { window.__wbClosingField = app.plugins.plugins.whiteboat.entry.waterField; app.plugins.plugins.whiteboat.entry.closeEntryImmediately(); });
  assert.equal(await ev(() => window.__wbClosingField.destroyed), true);
  const fallback = await ev(() => {
    const proto = HTMLCanvasElement.prototype, old = proto.getContext;
    proto.getContext = function(type, ...args) { return type === "webgl2" ? null : old.call(this, type, ...args); };
    try { app.plugins.plugins.whiteboat.openWater(); } finally { proto.getContext = old; }
    const field = app.plugins.plugins.whiteboat.entry.waterField;
    return { active: !!field.fallback, hidden: getComputedStyle(field.canvas).visibility, replacement: getComputedStyle(field.fallbackCanvas).visibility };
  });
  assert.equal(fallback.active, true); assert.equal(fallback.hidden, "hidden"); assert.equal(fallback.replacement, "visible");
  report.checks.push({ name: "2d-fallback-with-visible-sibling", fallback });
  await ev(() => { app.plugins.plugins.whiteboat.entry.closeEntryImmediately(); app.plugins.plugins.whiteboat.openWater(); });
  await sleep(250); assert.deepEqual(errors, []);
  report.status = "passed";
  await shot("public-ready");
} catch (error) { report.status = "failed"; report.error = error.stack; process.exitCode = 1; }
finally { await fs.writeFile(path.join(output, "runtime.json"), JSON.stringify(report, null, 2) + "\n"); await call("Emulation.setFocusEmulationEnabled", { enabled: false }).catch(() => {});
  socket.close(); }
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, error: report.error }));
