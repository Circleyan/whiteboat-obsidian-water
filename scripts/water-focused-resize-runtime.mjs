import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const endpoint = process.env.WB_CDP_ENDPOINT;
const expected = process.env.WB_CDP_VAULT_ROOT;
const output = process.env.WB_RUNTIME_OUTPUT;
if (!endpoint || !expected || !output) throw new Error("Explicit isolated endpoint, Vault and output required");
const targets = await fetch(`${endpoint}/json/list`).then(r => r.json());
const target = targets.find(t => t.type === "page" && t.url === "app://obsidian.md/index.html");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
});
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 15000);
    pending.set(id, message => {
      clearTimeout(timer);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(fn, arg) {
  const result = await call("Runtime.evaluate", {
    expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const report = { kind: "whiteboat-water-focused-native-resize", recordedAt: new Date().toISOString(), cases: [], errors,
  boundary: "Real Electron native window bounds; water alpha sampled immediately after resize and after paint. Full screenshots retain focus blur. Human visual acceptance remains separate." };
let snapshot;
try {
  await fs.mkdir(output, { recursive: true });
  await call("Runtime.enable");
  const vault = await evaluate(() => app.vault.adapter.basePath);
  assert.equal(path.resolve(vault), path.resolve(expected), "Refusing to resize an unregistered Vault");
  report.vault = vault;
  snapshot = await evaluate(() => {
    const win = require("electron").remote.getCurrentWindow();
    win.show(); win.focus(); require("electron").remote.getCurrentWebContents().focus();
    app.plugins.plugins.whiteboat.openWater();
    const entry = app.plugins.plugins.whiteboat.entry;
    window.__wbResizeSnapshot = { body: document.body.className, theme: app.customCss.theme, bounds: win.getBounds(),
      entry, draft: entry.ideaEl.value, open: entry.state.composerOpen };
    return { version: app.plugins.plugins.whiteboat.manifest.version };
  });
  report.version = snapshot.version;
  for (const theme of ["", "Minimal", "Cupertino"]) {
    for (const dark of [false, true]) {
      for (const reduced of [false, true]) {
        await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
        const result = await evaluate(async config => {
          app.customCss.setTheme(config.theme);
          document.body.classList.toggle("theme-dark", config.dark);
          document.body.classList.toggle("theme-light", !config.dark);
          await new Promise(resolve => setTimeout(resolve, 180));
          const entry = window.__wbResizeSnapshot.entry;
          const field = entry.waterField;
          field.refreshColors();
          entry.openComposer({ focus: true });
          const draft = "缩放中的想法 / Resize draft 🌊";
          entry.ideaEl.value = draft;
          entry.ideaEl.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 800));
          const originalResize = field.resize;
          const samples = [];
          const read = () => {
            const { width, height } = field.canvas;
            const pixels = field.context.getImageData(0, 0, width, height).data;
            let painted = 0;
            for (let index = 3; index < pixels.length; index += 64) if (pixels[index]) painted++;
            return { width, height, painted };
          };
          field.resize = function () { originalResize.call(this); samples.push({ stage: "resize-return", ...read() }); };
          const win = require("electron").remote.getCurrentWindow();
          try {
            for (let index = 0; index < 24; index++) {
              // Continuous resize crosses the compact layout breakpoint in both directions.
              const step = index < 12 ? index : 23 - index;
              win.setBounds({ ...window.__wbResizeSnapshot.bounds, width: 500 + step * 58, height: 600 + step * 8 });
              await new Promise(resolve => setTimeout(resolve, 24));
              samples.push({ stage: "post-paint", ...read() });
            }
            return { ...config, samples, focused: document.activeElement === entry.ideaEl,
              draftPreserved: entry.ideaEl.value === draft, composerOpen: entry.state.composerOpen,
              focusMode: entry.rootEl.dataset.waterFocus, reducedActual: entry.motionQuery.matches,
              blur: [...entry.focusVeilEl.children].map(el => getComputedStyle(el).backdropFilter) };
          } finally { field.resize = originalResize; }
        }, { theme, dark, reduced });
        result.blank = result.samples.filter(sample => sample.painted === 0).length;
        report.cases.push(result);
        const capture = await call("Page.captureScreenshot", { format: "png" });
        await fs.writeFile(path.join(output, `${theme || "default"}-${dark ? "dark" : "light"}-${reduced ? "reduced" : "motion"}.png`), Buffer.from(capture.data, "base64"));
      }
    }
  }
  for (const result of report.cases) {
    assert.equal(result.blank, 0, `Blank water frames: ${result.theme}/${result.dark}/${result.reduced}`);
    assert.equal(result.focused, true); assert.equal(result.draftPreserved, true); assert.equal(result.composerOpen, true);
    assert.equal(result.focusMode, "focused"); assert.equal(result.reducedActual, result.reduced);
    assert.ok(result.samples.some(sample => sample.stage === "resize-return"));
    assert.ok(result.blur.every(blur => blur.startsWith("blur(")), "Focus blur must remain enabled");
  }
  assert.deepEqual(errors, []);
  report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally {
  if (snapshot) {
    await call("Emulation.setEmulatedMedia", { features: [] }).catch(() => {});
    await evaluate(() => {
      const saved = window.__wbResizeSnapshot;
      app.customCss.setTheme(saved.theme); document.body.className = saved.body;
      require("electron").remote.getCurrentWindow().setBounds(saved.bounds);
      saved.entry.ideaEl.value = saved.draft;
      saved.entry.ideaEl.dispatchEvent(new Event("input", { bubbles: true }));
      if (saved.open) saved.entry.openComposer({ focus: true }); else saved.entry.closeComposer();
      delete window.__wbResizeSnapshot;
    }).catch(error => { report.cleanupError = error.message; });
  }
  await fs.writeFile(path.join(output, "resize-runtime.json"), JSON.stringify(report, null, 2) + "\n");
  ws.close();
}
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, samples: report.cases.reduce((n, c) => n + c.samples.length, 0), errors }));
