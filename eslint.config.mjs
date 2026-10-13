import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["node_modules/**", "vendor/**/node_modules/**", "vendor/**/lib/**", "main.js", "test/**", "scripts/**"] },
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true } } },
  // Core is host-neutral: native DOM and universal timers are valid there.
  { files: ["vendor/whiteboat-core/src/**/*.ts"], rules: {
    "obsidianmd/prefer-create-el": "off",
    "obsidianmd/prefer-window-timers": "off",
    "obsidianmd/no-global-this": "off",
  } },
  { files: ["src/**/*.ts"], rules: {
    "obsidianmd/ui/sentence-case": ["warn", { brands: ["Whiteboat"] }],
  } },
]);
