import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
 resolve: { alias: { obsidian: path.resolve("test/unit/stubs/obsidian.ts") } },
 test: { environment: "node", include: ["test/unit/canvas-creation*.spec.ts", "test/unit/water-release.spec.ts"] }
});
