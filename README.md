# Whiteboat / 白舟

Begin on a quiet water surface. Watch the boat, listen to the water, and write a thought when you are ready. Enter a new native Canvas with that thought, or start with an empty Canvas.

## Use

- Whiteboat opens its water surface after your vault starts. You can also use the ribbon boat icon or the **Whiteboat: Open water surface** command.
- Click the water or the boat to write. Use the visible submit control or Command/Ctrl + Enter to create a Canvas.
- An empty submission creates an empty Canvas. Text becomes a normal editable text node.
- Press Escape to dismiss the input, then Escape again to close the surface. Closing the surface does not create a Canvas.
- Change the Canvas folder, boat speed, light intensity, water depth, and water sound in the plugin preferences. The default folder is `随手画布`.
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
npm run build
npm run lint:community
npm test
npm --prefix vendor/whiteboat-core test
npm run check:release
```

This repository contains only the first-release source snapshot and the shared water source it consumes. Shared source provenance and exact revisions are recorded in [source-provenance.json](source-provenance.json). No private repository access is needed to build.

The root build prepares and builds the pinned core automatically, including its types and shared water CSS. CI uses this same clean-root sequence. Core owns shared rendering and motion; this repository owns Obsidian APIs, native Canvas lifecycle and packaging.
