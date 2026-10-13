import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const endpoint = process.env.WB_CDP_ENDPOINT;
const vaultRoot = process.env.WB_CDP_VAULT_ROOT;
const output = process.env.WB_RUNTIME_OUTPUT;
if (!endpoint || !vaultRoot || !output) throw new Error("Explicit isolated endpoint, Vault and output required");
await fs.mkdir(output, { recursive: true });
const targets = await fetch(`${endpoint}/json/list`).then(r => r.json());
const ws = new WebSocket(targets.find(t => t.type === "page" && t.url === "app://obsidian.md/index.html").webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
  pending.delete(message.id);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
  pending.set(id, result => { clearTimeout(timeout); result.error ? reject(new Error(result.error.message)) : resolve(result.result); });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (fn, arg) => {
  const result = await call("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
assert.equal(path.resolve(await evaluate(() => app.vault.adapter.basePath)), path.resolve(vaultRoot));
const results = [];
try {
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await call("Page.bringToFront");
  for (const theme of ["light", "dark"]) {
    for (const zoom of [1, 1.25]) {
      await evaluate(async ({ theme, zoom }) => {
        await app.plugins.unloadPlugin("whiteboat");
        require("electron").webFrame.setZoomFactor(zoom);
        document.body.classList.toggle("theme-dark", theme === "dark");
        document.body.classList.toggle("theme-light", theme === "light");
        await app.plugins.loadPlugin("whiteboat");
      }, { theme, zoom });
      for (let retry = 0; retry < 40; retry++) {
        if (await evaluate(() => !!document.querySelector(".whiteboat-canvas-entry__water"))) break;
        await pause(100);
      }
      await evaluate(() => document.querySelector(".whiteboat-canvas-entry__water").dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 450, clientY: 300 })));
      await pause(800);
      const state = await evaluate(() => {
        const selectors = [".whiteboat-canvas-entry-modal-container", ".whiteboat-canvas-entry", ".whiteboat-canvas-entry__composer", ".whiteboat-canvas-entry__idea"];
        return selectors.map(selector => {
          const el = document.querySelector(selector), css = getComputedStyle(el), r = el.getBoundingClientRect();
          return { selector, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, style: Object.fromEntries(["position", "visibility", "width", "height", "backgroundColor", "color", "fontSize", "whiteSpace", "transform", "filter", "opacity", "padding", "boxSizing"].map(name => [name, css[name]])) };
        });
      });
      const motion = await evaluate(() => {
        const motion = app.plugins.plugins.whiteboat.entry.composerMotion;
        const ghost = motion.leavePicture();
        const echo = ghost?.querySelector(".whiteboat-canvas-entry__idea");
        const echoWhiteSpace = echo ? getComputedStyle(echo).whiteSpace : null;
        const ghostWidth = ghost?.getBoundingClientRect().width;
        motion.cancel();
        const cancelling = getComputedStyle(motion.composer).visibility;
        return { cancelling, echoWhiteSpace, ghostWidth };
      });
      assert.equal(motion.cancelling, "visible");
      assert.equal(motion.echoWhiteSpace, "pre-wrap");
      await pause(350);
      const closed = await evaluate(() => ({ visibility: getComputedStyle(app.plugins.plugins.whiteboat.entry.composerMotion.composer).visibility, motion: app.plugins.plugins.whiteboat.entry.composerMotion.composer.dataset.motion }));
      // cancel() alone does not change the modal's is-open; compare the state to baseline.
      await evaluate(() => app.plugins.plugins.whiteboat.entry.composerMotion.reset());
      const impact = await evaluate(async () => {
        const m = app.plugins.plugins.whiteboat.entry.composerMotion;
        const finished = m.confirm(true);
        await new Promise(resolve => setTimeout(resolve, 850));
        // Drive the allocated pass once even if this isolated window is backgrounded.
        m.impact?.draw(0.85);
        const visibility = getComputedStyle(m.water).visibility;
        const canvasCount = document.querySelectorAll(".whiteboat-canvas-entry__water-impact").length;
        m.reset(); await finished;
        return { visibility, canvasCount, restored: getComputedStyle(m.water).visibility, remaining: document.querySelectorAll(".whiteboat-canvas-entry__water-impact").length };
      });
      if (impact.canvasCount) assert.equal(impact.visibility, "hidden");
      assert.equal(impact.restored, "visible"); assert.equal(impact.remaining, 0);
      results.push({ theme, zoom, state, motion, closed, impact });
    }
  }
  await evaluate(() => require("electron").webFrame.setZoomFactor(1));
  await fs.writeFile(path.join(output, "equivalence.json"), JSON.stringify({ vault: vaultRoot, results }, null, 2));
  console.log(`Verified ${results.length} theme/zoom combinations and motion cleanup.`);
} finally { ws.close(); }
