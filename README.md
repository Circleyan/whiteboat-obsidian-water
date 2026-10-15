# Whiteboat / 白舟

Begin on a quiet water surface. Watch the boat, listen to the water, and write a thought when you are ready. Enter a new native Canvas with that thought, or start with an empty Canvas.

## Use

- Whiteboat opens its water surface after your vault starts. You can also use the ribbon boat icon or the **Whiteboat: Open water surface** command.
- Click the water or the boat to write. Use the visible submit control or Command/Ctrl + Enter to create a Canvas.
- An empty submission creates an empty Canvas. Text becomes a normal editable text node.
- Press Escape to dismiss the input, then Escape again to close the surface. Closing the surface does not create a Canvas.
- Change the Canvas folder, boat speed, light intensity, water depth, and water sound in the plugin preferences. The default folder follows the interface language: `Canvases`, `随手画布`, or `隨手畫布`.
- Once the Canvas opens, editing is handled by Obsidian. This initial release contains the water entry and its soundscape. Source scope and Product IDs are recorded in [release-scope.json](release-scope.json).

## Install

After a GitHub Release is available, install through BRAT with `Circleyan/whiteboat-obsidian-water`, or download `main.js`, `manifest.json`, and `styles.css` from [GitHub Releases](https://github.com/Circleyan/whiteboat-obsidian-water/releases) into `<vault>/.obsidian/plugins/whiteboat/`. Then enable Whiteboat in Community plugins.

## Compatibility

Requires Obsidian 1.8.10 or later and the built-in Canvas plugin. This release supports desktop only because the boat uses Electron to follow the pointer outside the window. iPad and phone are not supported in this release.

## Privacy and permissions

The water surface, boat, and sounds are bundled and work offline. No account, payment, analytics, AI service, or network connection is needed for the supported desktop flow. New Canvas files and preferences stay in your vault. Whiteboat does not access files outside your vault.

On desktop, an optional Electron bridge reads the pointer position while the water surface is open so the boat can follow the pointer; it stops when the surface closes. If that bridge is unavailable, in-window pointer movement still works.

Existing experimental phone paths can request microphone access only after an explicit recording gesture; any recording is saved locally. If you invoke browser speech recognition on a compatible device, the device/browser speech service may process speech online. These phone paths are outside the first release support promise.

## License and credits

Whiteboat is MIT licensed; see [LICENSE](LICENSE). It uses [Three.js](https://threejs.org/) (MIT), [Howler.js](https://howlerjs.com/) (MIT), and the Whiteboat shared core (MIT). The bundled sailing water loop is CC0. The idea-drop and rock-splash sounds are licensed under the Pixabay Content License. Source credits and processing details are in [AUDIO-LICENSE.md](AUDIO-LICENSE.md).

## Build from source

```sh
npm ci --ignore-scripts
npm run check:community
npm run test:community-source
npm test
npm --prefix vendor/whiteboat-core test
npm run check:release
```

This repository contains only the first-release source snapshot and the shared water source it consumes. Shared source provenance and exact revisions are recorded in [source-provenance.json](source-provenance.json). No private repository access is needed to build.

The root build prepares and builds the pinned core automatically, including its types and shared water CSS. Core owns shared rendering and motion; this repository owns Obsidian APIs, native Canvas lifecycle and packaging.

`check:community` scans an isolated clean source snapshot without generated core types, builds, then scans the built source and checks CSS. This works even after a local build and never deletes your generated files. CI and the Release packaging gate run this same sequence and upload full JSON diagnostics from `community-check-reports/`, including failures.

Both clean and built scans require zero diagnostics. The root TypeScript configuration resolves the pinned core directly from its source, so a clean checkout does not depend on generated declarations. The historical fingerprint baseline is retained as an audit record and no longer permits warnings. CI records full diagnostics rather than updating the baseline automatically. These checks use the recommended Obsidian ESLint configuration; the official server also runs separate checks.

CSS priority changes also have a host regression fixture: run `scripts/water-css-equivalence-runtime.mjs` against an explicit isolated Vault, with `WB_BASELINE_CSS` pointing to the previously accepted release. It compares default, Minimal and Cupertino themes in light/dark and wide/narrow states, while keeping the live DOM fixed. Install these themes in the isolated Vault before running it. Runtime tests require explicit `WB_CDP_ENDPOINT`, `WB_CDP_VAULT_ROOT` and `WB_RUNTIME_OUTPUT`.

## Interface language

Whiteboat follows the Obsidian language by default, with English as the fallback. English, Simplified Chinese and Traditional Chinese are supported. Choose a language in Whiteboat settings to override Obsidian. The default Canvas folder changes with the language for new files; existing files stay in place. A custom folder keeps its name. Clear the folder setting to restore the automatic default. Switching languages preserves your draft. Water sound controls both background water and thought-drop sounds.
