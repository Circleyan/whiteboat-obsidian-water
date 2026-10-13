import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// The host prepares its pinned dependency; shared behavior remains in core.
const coreRoot = fileURLToPath(new URL("../vendor/whiteboat-core/", import.meta.url));
if (!existsSync(new URL("../vendor/whiteboat-core/package-lock.json", import.meta.url))) {
  throw new Error("Pinned whiteboat-core source is missing. Initialize the vendor checkout before building.");
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const args of [["ci", "--ignore-scripts", "--no-audit", "--no-fund"], ["run", "build"]]) {
  const result = spawnSync(npm, args, { cwd: coreRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
