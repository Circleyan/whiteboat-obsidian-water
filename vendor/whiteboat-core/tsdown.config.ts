import type { UserConfig } from "tsdown";

const config: UserConfig = {
  name: "whiteboat-core",
  entry: {
    index: "src/index.ts",
    "boat-water-sound": "src/features/boat-water-sound.ts",
    "boat-water-source": "src/features/boat-water-source.ts",
    "composer-motion": "src/features/canvas-creation-composer-motion.ts",
    "water-field": "src/features/canvas-creation-water-field.ts",
    "water-impact": "src/features/canvas-creation-water-impact.ts",
    navigation: "src/features/canvas-creation-navigation.ts",
    "boat-assets": "src/features/canvas-creation-boat-assets.ts",
    light: "src/features/canvas-creation-light.ts",
    projection: "src/features/canvas-creation-projection.ts",
    "speech-input": "src/features/idea-speech-input.ts",
  },
  outDir: "lib",
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  clean: true,
  loader: {
    ".svg": "text",
    ".mp3": "dataurl",
  },
};

export default config;
