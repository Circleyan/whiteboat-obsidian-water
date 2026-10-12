import esbuild from "esbuild";
const production = process.argv[2] === "production";
await esbuild.build({
  entryPoints: ["src/main.ts"], bundle: true, external: ["obsidian", "electron"],
  format: "cjs", target: "es2020", logLevel: "info", treeShaking: true,
  sourcemap: production ? false : "inline", loader: { ".svg": "text", ".mp3": "dataurl" },
  outfile: "main.js", minify: false,
});
