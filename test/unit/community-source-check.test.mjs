import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCleanSource, fingerprintDiagnostics, compareBaseline, validateScan, unacceptedDiagnostics } from "../../scripts/check-community-source.mjs";

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "whiteboat-scan-test-"));
  try { await run(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("clean scan isolates core resolution and preserves existing generated types", () => fixture(async root => {
  const source = path.join(root, "source");
  const target = path.join(root, "clean");
  const files = ["src/main.ts", "package.json", "manifest.json", "eslint.config.mjs", "tsconfig.json", "vendor/whiteboat-core/src/index.ts",
    "vendor/whiteboat-core/package.json", "vendor/whiteboat-core/tsconfig.json", "vendor/whiteboat-core/lib/index.d.ts", "node_modules/eslint/package.json"];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await fs.writeFile(path.join(source, file), "existing");
  }
  await fs.symlink(path.join(source, "vendor/whiteboat-core"), path.join(source, "node_modules/whiteboat-core"), "junction");
  await createCleanSource(source, target);
  assert.equal(await fs.realpath(path.join(target, "node_modules/whiteboat-core")), await fs.realpath(path.join(target, "vendor/whiteboat-core")));
  await assert.rejects(fs.access(path.join(target, "node_modules/whiteboat-core/lib/index.d.ts")));
  assert.equal(await fs.readFile(path.join(source, "vendor/whiteboat-core/lib/index.d.ts"), "utf8"), "existing");
  assert.equal(await fs.readFile(path.join(target, "node_modules/eslint/package.json"), "utf8"), "existing");
}));

test("baseline rejects a new expression and increased multiplicity; line moves and resolved findings pass", () => fixture(async root => {
  const filePath = path.join(root, "main.ts");
  const message = { ruleId: "unsafe", severity: 2, message: "Unsafe call", line: 1, column: 1, endColumn: 6 };
  await fs.writeFile(filePath, "old()\n");
  const old = await fingerprintDiagnostics([{ filePath, messages: [message] }], root);
  const baseline = { schemaVersion: 1, fingerprints: old };
  await fs.writeFile(filePath, "\nold()\n");
  const moved = await fingerprintDiagnostics([{ filePath, messages: [{ ...message, line: 2 }] }], root);
  assert.deepEqual(compareBaseline(moved, baseline), []);
  assert.deepEqual(compareBaseline({}, baseline), []);
  const duplicate = await fingerprintDiagnostics([{ filePath, messages: [ { ...message, line: 2 }, { ...message, line: 2 }] }], root);
  assert.equal(compareBaseline(duplicate, baseline).length, 1);
  await fs.writeFile(filePath, "new()\n");
  const changed = await fingerprintDiagnostics([{ filePath, messages: [message] }], root);
  assert.equal(compareBaseline(changed, baseline).length, 1);
  const warning = await fingerprintDiagnostics([{ filePath, messages: [{ ...message, severity: 1 }] }], root);
  assert.equal(compareBaseline(warning, baseline).length, 1);
}));

test("parser failures and diagnostics outside the snapshot cannot be baselined", () => fixture(async root => {
  const filePath = path.join(root, "main.ts");
  await fs.writeFile(filePath, "x");
  await assert.rejects(fingerprintDiagnostics([{ filePath, messages: [{ fatal: true, message: "Parser failed" }] }], root), /Invalid source scan/u);
  await assert.rejects(fingerprintDiagnostics([{ filePath: path.join(root, "../outside.ts"), messages: [] }], root), /outside source snapshot/u);
  assert.throws(() => compareBaseline({}, { schemaVersion: 1, fingerprints: { arbitrary: 10 } }), /Invalid/u);
}));

test("ESLint operational failures and contradictory status fail closed", () => {
  const diagnostics = [{ errorCount: 1, messages: [{ severity: 2 }] }];
  validateScan({ status: 1 }, diagnostics);
  validateScan({ status: 0 }, [{ errorCount: 0, messages: [] }]);
  for (const result of [{ status: 2 }, { status: null, signal: "SIGTERM" }, { status: 0, error: new Error("failed") }]) {
    assert.throws(() => validateScan(result, diagnostics), /did not complete/u);
  }
  assert.throws(() => validateScan({ status: 1 }, [{ errorCount: 0 }]), /contradicts/u);
  assert.throws(() => validateScan({ status: 0 }, diagnostics), /contradicts/u);
  assert.throws(() => validateScan({ status: 0 }, []), /did not complete/u);
});


test("both phases reject even a finding previously accepted by the historical baseline", () => {
  const old = { ["a".repeat(64)]: 2 };
  assert.deepEqual(compareBaseline(old, { schemaVersion: 1, fingerprints: old }), []);
  assert.deepEqual(unacceptedDiagnostics(old), Object.entries(old));
  assert.deepEqual(unacceptedDiagnostics({}), []);
});
