import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Check an isolated source snapshot so prior builds cannot conceal unresolved
// core types. Never remove generated files from a developer's checkout.
export async function createCleanSource(root, target) {
  const files = ["src", "package.json", "manifest.json", "tsconfig.json", "eslint.config.mjs",
    "vendor/whiteboat-core/src", "vendor/whiteboat-core/package.json",
    "vendor/whiteboat-core/tsconfig.json"];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await fs.cp(path.join(root, file), path.join(target, file), { recursive: true });
  }
  await fs.mkdir(path.join(target, "node_modules"), { recursive: true });
  for (const name of await fs.readdir(path.join(root, "node_modules"))) {
    if (name === "whiteboat-core") continue;
    await fs.symlink(path.join(root, "node_modules", name), path.join(target, "node_modules", name), "junction");
  }
  await fs.symlink(path.join(target, "vendor/whiteboat-core"), path.join(target, "node_modules/whiteboat-core"), "junction");
}

export async function fingerprintDiagnostics(results, root) {
  const fingerprints = {};
  for (const file of results) {
    const relative = path.relative(root, file.filePath).split(path.sep).join("/");
    if (relative.startsWith("../") || path.isAbsolute(relative)) throw new Error("Diagnostic outside source snapshot");
    const lines = (await fs.readFile(file.filePath, "utf8")).split(/\r?\n/u);
    for (const message of file.messages) {
      if (message.fatal || !message.ruleId) throw new Error(`Invalid source scan: ${relative}: ${message.message}`);
      const span = lines.slice(message.line - 1, message.endLine ?? message.line);
      if (span.length) {
        span[span.length - 1] = span.at(-1).slice(0, (message.endColumn ?? Infinity) - 1);
        span[0] = span[0].slice(message.column - 1);
      }
      const identity = [relative, message.ruleId, message.severity, message.message, span.join("\n")];
      const key = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
      fingerprints[key] = (fingerprints[key] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(fingerprints).sort(([a], [b]) => a.localeCompare(b)));
}

export function compareBaseline(actual, baseline) {
  if (baseline.schemaVersion !== 1 || !baseline.fingerprints ||
      Object.entries(baseline.fingerprints).some(([key, count]) => !/^[a-f0-9]{64}$/u.test(key) || !Number.isSafeInteger(count) || count <= 0)) {
    throw new Error("Invalid clean-source baseline");
  }
  // Resolved findings may disappear. A new file, expression, rule, severity,
  // message or increased multiplicity fails; warnings are never auto-baselined.
  return Object.entries(actual).map(([key, count]) => [key, count - (baseline.fingerprints[key] ?? 0)]).filter(([, count]) => count > 0);
}

// The old baseline remains an audit artifact; all present findings fail.
export function unacceptedDiagnostics(fingerprints) {
  return Object.entries(fingerprints);
}

export function validateScan(result, results) {
  if (result.error || result.signal || ![0, 1].includes(result.status) || !Array.isArray(results) || !results.length) {
    throw new Error(`ESLint did not complete: ${result.error?.message ?? result.stderr ?? result.status}`);
  }
  const errors = results.reduce((sum, file) => sum + file.errorCount, 0);
  if (!Number.isFinite(errors) || (result.status === 1 && errors === 0) || (result.status === 0 && errors > 0)) throw new Error("ESLint exit status contradicts diagnostics");
}

async function scan(root, phase, output) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/eslint/bin/eslint.js"),
    "src", "vendor/whiteboat-core/src", "--format", "json"], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const results = JSON.parse(result.stdout || "null");
  validateScan(result, results);
  await fs.mkdir(output, { recursive: true });
  const portable = results.map(file => ({ ...file, filePath: path.relative(root, file.filePath).split(path.sep).join("/") }));
  await fs.writeFile(path.join(output, `${phase}.json`), JSON.stringify(portable, null, 2) + "\n");
  return { results, fingerprints: await fingerprintDiagnostics(results, root) };
}

export async function checkCommunitySource(root, phase) {
  if (!["clean", "built"].includes(phase)) throw new Error("Use check-community-source.mjs clean|built");
  const output = path.join(root, "community-check-reports");
  if (phase === "clean") await fs.rm(output, { recursive: true, force: true });
  const scratch = phase === "clean" ? await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "whiteboat-source-"))) : null;
  try {
    if (scratch) await createCleanSource(root, scratch);
    else await fs.access(path.join(root, "vendor/whiteboat-core/lib/index.d.ts"));
    const { results, fingerprints } = await scan(scratch ?? root, phase, output);
    const unexpected = unacceptedDiagnostics(fingerprints);
    const counts = {};
    for (const file of results) for (const message of file.messages) counts[message.ruleId] = (counts[message.ruleId] ?? 0) + 1;
    const summary = { phase, diagnostics: Object.values(counts).reduce((a, b) => a + b, 0), counts,
      unexpectedDiagnostics: unexpected.reduce((sum, [, count]) => sum + count, 0), passed: unexpected.length === 0 };
    await fs.writeFile(path.join(output, `${phase}-summary.json`), JSON.stringify(summary, null, 2) + "\n");
    console.log(JSON.stringify(summary, null, 2));
    if (unexpected.length) throw new Error(`${phase} source scan has unaccepted diagnostics; inspect ${output}`);
    return summary;
  } catch (error) {
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, `${phase}-failure.txt`), String(error) + "\n");
    throw error;
  } finally {
    if (scratch) await fs.rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === "all") {
    const invoke = (command, args) => spawnSync(command, args, { stdio: "inherit" }).status === 0;
    const phase = name => invoke(process.execPath, [process.argv[1], name]);
    const npm = name => process.env.npm_execpath
      ? invoke(process.execPath, [process.env.npm_execpath, "run", name])
      : invoke("npm", ["run", name]);
    const cleanPassed = phase("clean");
    // Retain both reports even when the clean regression gate fails. A failed
    // build prevents the built scan; it cannot accidentally reuse old types.
    const buildPassed = npm("build");
    const builtPassed = buildPassed && phase("built");
    const cssPassed = buildPassed && npm("check:community-css");
    process.exitCode = cleanPassed && buildPassed && builtPassed && cssPassed ? 0 : 1;
  } else {
    await checkCommunitySource(process.cwd(), process.argv[2]);
  }
}
