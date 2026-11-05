# Changelog

## 0.2.0 — 2026-11-05

### Added

- Optionally display water behind the current Canvas with the **Water surface** preference, off by default. Background drawing is limited to 30 fps and approximately two million pixels, and stops when hidden.

### Changed

- The water surface now has quiet fine lines, moving waves and local boat contact color.
- Slow the default boat speed to 60%, preserving previously saved preferences.
- The settings retain the familiar folder, sound, boat speed, light and depth controls; no experimental appearance or mode controls are exposed.

### Fixed

- Restore the water safely after graphics context loss, with a 2D fallback when WebGL 2 is unavailable.

## 0.1.4

- Reduce water drawing work during boat and pointer movement on large desktop displays.
- Keep 60 Hz frame scheduling steady when animation timestamps are rounded.
- Preserve the existing water density, colors, boat motion, sound and Canvas behavior.

## 0.1.3

- Keep the focused water surface painted while resizing the desktop window, preserving the draft and focus blur.
- Resolve shared core types directly from source and require zero diagnostics before and after building.
- Supply DOM helpers and browser timers from the host while retaining core water and audio behavior.
- Replace water CSS priority overrides with owned, scoped selectors and verify theme, zoom and motion equivalence.

## 0.1.2

- Follow the Obsidian interface language with English, Simplified Chinese and Traditional Chinese support and an English fallback.
- Choose the interface language in settings; open drafts and water effects stay in place when switching.
- Use Canvases / 随手画布 / 隨手畫布 for the automatic Canvas folder. Existing files stay in place and custom folders retain their names.
- Check community source before and after building, blocking new diagnostics while keeping existing findings visible.

## 0.1.1

- Build pinned core automatically, verify release source and attest GitHub assets.
- Preserve water visuals and motion with scoped CSS and native settings.

## 0.1.0

- Open a quiet water surface and create a native Canvas from a thought or an empty entry.
- Save water sound, Canvas folder, boat speed, light intensity and water depth preferences.
- Support desktop light/dark themes and reduced motion.
