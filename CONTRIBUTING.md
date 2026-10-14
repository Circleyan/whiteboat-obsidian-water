# Contributing

Report reproducible problems with your Obsidian version, operating system, theme, and steps. Avoid attaching private vault content.

Run `npm run check:community`, `npm run test:community-source` and the tests documented in README.md. Inspect both clean and built source reports. Do not build core before a clean scan to hide diagnostics, disable unsafe rules, or regenerate the baseline to accept a regression. Baseline changes need an explicit diagnosis and review; resolved findings can be removed. Shared water behavior, motion, audio and rendering recipes come from Whiteboat core; changes must originate in that source and be projected with exact provenance. Obsidian adapters and packaging belong here.

Preserve the accepted water experience. Verify light/dark themes, zoom, reduced motion, input/Escape, native Canvas creation, optional desktop pointer tracking and unload cleanup. Published tags and assets are immutable; corrections use a new version.
