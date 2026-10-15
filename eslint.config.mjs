import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["node_modules/**", "vendor/**/node_modules/**", "vendor/**/lib/**", "main.js", "test/**", "scripts/**"] },
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true } } },
  { files: ["src/**/*.ts"], rules: {
    "obsidianmd/ui/sentence-case": ["warn", { brands: ["Whiteboat"] }],
  } },
]);
