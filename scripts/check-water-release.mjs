import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
assert.equal(manifest.id, "whiteboat");
assert.equal(manifest.name, "Whiteboat");
assert.equal(manifest.isDesktopOnly, true, "Electron pointer tracking requires desktop-only support");
assert.equal(manifest.version, pkg.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.ok(manifest.description.length <= 250 && manifest.description.endsWith("."));
for (const file of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE"]) assert.ok(fs.statSync(file).size > 0);
const bundle = fs.readFileSync("main.js", "utf8");
assert.ok(!bundle.includes("// src/text.ts") && !bundle.includes("deepDiveCanvasScope"), "Full-product vocabulary leaked into water distribution");
const css = fs.readFileSync("styles.css", "utf8");
for (const name of ["child_process", "fs", "http", "net", "claudian", "mind-elixir", "web-clipper-bridge", "deep-dive-answer-modal", "requirement-reflection-home"]) {
 assert.ok(!bundle.includes(`require("${name}")`) && !bundle.includes(`src/features/${name}`), `Unexpected dependency: ${name}`);
}
for (const hostSelector of [".canvas-wrapper", ".markdown-preview-view", ".workspace-leaf", "whiteboat-wake-host", "whiteboat-html-parameter"]) assert.ok(!css.includes(hostSelector), `Canvas-wide CSS leaked: ${hostSelector}`);
console.log(`Whiteboat ${manifest.version}: release identity, files, dependency and CSS boundaries passed.`);

const provenance = JSON.parse(fs.readFileSync("source-provenance.json", "utf8"));
const projected = new Set(provenance.projected_metadata);
for (const [file, hash] of Object.entries(provenance.core_source_files)) {
 if (projected.has(file)) continue;
 assert.equal(createHash("sha256").update(fs.readFileSync(`vendor/whiteboat-core/${file}`)).digest("hex"), hash, `Shared source drift: ${file}`);
}
console.log("Shared water source matches the recorded revision snapshot.");
for (const [group, files] of Object.entries({
 "Obsidian water": provenance.obsidian_source_files,
 "distribution template": provenance.distribution_template_files,
})) {
 assert.ok(files && Object.keys(files).length > 0, `Missing ${group} provenance`);
 for (const [file, hash] of Object.entries(files)) {
  assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), hash, `${group} source drift: ${file}`);
 }
}
console.log("Obsidian water source and distribution templates match the recorded projection.");
