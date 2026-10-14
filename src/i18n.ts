import { getLanguage } from "obsidian";
import { canvasCreationEntryText, type CanvasCreationEntryLanguage } from "./features/canvas-creation-entry-text";
export type WaterLanguagePreference = "auto" | CanvasCreationEntryLanguage;
export function normalizeWaterLanguage(value: unknown): WaterLanguagePreference {
  return value === "en" || value === "zh-CN" || value === "zh-TW" ? value : "auto";
}
export function resolveWaterLanguage(preference: WaterLanguagePreference, hostLanguage: string): CanvasCreationEntryLanguage {
  if (preference !== "auto") return preference;
  // Obsidian uses zh and zh-TW; accept their explicit region/script aliases too.
  const host = hostLanguage.toLowerCase().replace(/_/g, "-");
  if (["zh", "zh-cn", "zh-sg", "zh-hans", "zh-hans-cn", "zh-hans-sg"].includes(host)) return "zh-CN";
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant", "zh-hant-tw", "zh-hant-hk", "zh-hant-mo"].includes(host)) return "zh-TW";
  return "en";
}
export function currentWaterLanguage(preference: WaterLanguagePreference): CanvasCreationEntryLanguage {
  if (preference !== "auto") return preference;
  try { return resolveWaterLanguage(preference, getLanguage()); } catch { return "en"; }
}
export const WATER_UI_TEXT = {
  "language": {
    "en": "Language",
    "zh-CN": "语言",
    "zh-TW": "語言"
  },
  "languageDesc": {
    "en": "Follow Obsidian or choose a language. Unsupported languages use English.",
    "zh-CN": "跟随 Obsidian 或选择语言。未支持的语言使用英语。",
    "zh-TW": "跟隨 Obsidian 或選擇語言。未支援的語言使用英語。"
  },
  "auto": {
    "en": "Follow Obsidian",
    "zh-CN": "跟随 Obsidian",
    "zh-TW": "跟隨 Obsidian"
  },
  "open": {
    "en": "Open water surface",
    "zh-CN": "打开水面",
    "zh-TW": "開啟水面"
  },
  "ribbon": {
    "en": "Open Whiteboat water surface",
    "zh-CN": "打开白舟水面",
    "zh-TW": "開啟白舟水面"
  },
  "folder": {
    "en": "Canvas folder",
    "zh-CN": "画布目录",
    "zh-TW": "畫布資料夾"
  },
  "folderDesc": {
    "en": "New canvases are saved here. Clear to use the default folder for your language. Existing files stay in place.",
    "zh-CN": "新画布保存到此目录。清空后使用当前语言的默认目录，已有文件保持原位。",
    "zh-TW": "新畫布儲存於此資料夾。清空後使用目前語言的預設資料夾，既有檔案保持原位。"
  },
  "sound": {
    "en": "Water sound",
    "zh-CN": "水声",
    "zh-TW": "水聲"
  },
  "soundDesc": {
    "en": "Play water and thought-drop sounds while the surface is open.",
    "zh-CN": "水面打开时播放背景水声和投入声音。",
    "zh-TW": "水面開啟時播放背景水聲和投入聲音。"
  },
  "speed": {
    "en": "Boat speed",
    "zh-CN": "小船速度",
    "zh-TW": "小船速度"
  },
  "speedDesc": {
    "en": "How quickly the boat follows the pointer.",
    "zh-CN": "小船跟随鼠标的速度。",
    "zh-TW": "小船跟隨游標的速度。"
  },
  "light": {
    "en": "Light intensity",
    "zh-CN": "光照强度",
    "zh-TW": "光照強度"
  },
  "lightDesc": {
    "en": "The strength of sunlight and moonlight.",
    "zh-CN": "日光和月光的强度。",
    "zh-TW": "日光和月光的強度。"
  },
  "depth": {
    "en": "Water depth",
    "zh-CN": "水深",
    "zh-TW": "水深"
  },
  "depthDesc": {
    "en": "The depth of the projected shadows.",
    "zh-CN": "投影阴影的深度。",
    "zh-TW": "投影陰影的深度。"
  },
  "languageSaveFailed": {
    "en": "Language could not be saved. Please try again.",
    "zh-CN": "语言没有保存，请再试一次。",
    "zh-TW": "語言未儲存，請再試一次。"
  }
} as const;
export type WaterUiTextKey = keyof typeof WATER_UI_TEXT;
export function waterUiText(language: CanvasCreationEntryLanguage, key: WaterUiTextKey): string {
  return WATER_UI_TEXT[key][language];
}
export { canvasCreationEntryText };
