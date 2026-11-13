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
  "lighting": {"en": "Light and depth", "zh-CN": "光照与水深", "zh-TW": "光照與水深"},
  "lightingDesc": {"en": "Drag the point to see changes immediately; release to save.", "zh-CN": "拖动圆点即时预览，松手保存。", "zh-TW": "拖動圓點即時預覽，放開儲存。"},
  "padHelp": {"en": "Left/right adjusts light; up/down adjusts depth. Arrow keys adjust; Shift makes larger changes; Escape cancels.", "zh-CN": "左右调整光照，上下调整水深。方向键调整，Shift 加大步长，Escape 取消。", "zh-TW": "左右調整光照，上下調整水深。方向鍵調整，Shift 加大步長，Escape 取消。"},
  "lightWeak": {"en": "Dim", "zh-CN": "弱光", "zh-TW": "弱光"},
  "lightStrong": {"en": "Bright", "zh-CN": "强光", "zh-TW": "強光"},
  "depthDeep": {"en": "Deeper", "zh-CN": "更深", "zh-TW": "更深"},
  "undo": {"en": "Undo", "zh-CN": "撤销", "zh-TW": "復原"},
  "reset": {"en": "Reset", "zh-CN": "重置", "zh-TW": "重設"},
  "previewHelp": {"en": "Move the pointer over the water to try the boat speed. Water sound can be heard while adjusting.", "zh-CN": "把鼠标移到水面上体验船速；调整水声时可直接试听。", "zh-TW": "將游標移到水面體驗船速；調整水聲時可直接試聽。"},
  "launchpadPreview": {"en": "Launchpad preview", "zh-CN": "启动台预览", "zh-TW": "啟動台預覽"},
  "canvasPreview": {"en": "Canvas preview", "zh-CN": "画布预览", "zh-TW": "畫布預覽"},
  "canvasPreviewDesc": {"en": "Preview water and water mark size without changing a Canvas.", "zh-CN": "即时预览水面和水纹大小，不修改画布。", "zh-TW": "即時預覽水面和水紋大小，不修改畫布。"},
  "canvasPreviewNode": {"en": "Your thought", "zh-CN": "你的想法", "zh-TW": "你的想法"},
  "previewThought": {"en": "Drop a thought", "zh-CN": "投入想法", "zh-TW": "投入想法"},
  "previewPlaceholder": {"en": "What is on your mind?", "zh-CN": "随便说说，你想到什么了？", "zh-TW": "隨意說說，你想到什麼了？"},
  "previewEnter": {"en": "Enter", "zh-CN": "回车", "zh-TW": "Enter"},

  "launchpadGroup": { "en": "Launchpad", "zh-CN": "启动台", "zh-TW": "啟動台" },
  "canvasGroup": { "en": "Canvas", "zh-CN": "画布", "zh-TW": "畫布" },
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
    "en": "New Canvas location",
    "zh-CN": "新建画布位置",
    "zh-TW": "新建畫布位置"
  },
  "folderDesc": {
    "en": "New canvases are saved here. Clear to use the default folder for your language. Existing files stay in place.",
    "zh-CN": "新画布保存到此目录。清空后使用当前语言的默认目录，已有文件保持原位。",
    "zh-TW": "新畫布儲存於此資料夾。清空後使用目前語言的預設資料夾，既有檔案保持原位。"
  },
  "canvasWater": { "en": "Water surface", "zh-CN": "水面", "zh-TW": "水面" },
  "canvasWaterScale": { "en": "Water mark size", "zh-CN": "水纹大小", "zh-TW": "水紋大小" },
  "canvasWaterScaleDesc": { "en": "Scale water marks in Canvas; 100% is the original size.", "zh-CN": "缩放画布中的水纹，100% 为原始大小。", "zh-TW": "縮放畫布中的水紋，100% 為原始大小。" },
  "canvasWaterDesc": { "en": "Show water behind the current Canvas. May use more power; pauses in the background.", "zh-CN": "为当前画布开启水面，可能增加耗电；后台自动暂停。", "zh-TW": "為目前畫布開啟水面，可能增加耗電；背景自動暫停。" },
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
  "settingsSaveFailed": { "en": "Settings could not be saved. Please try again.", "zh-CN": "设置没有保存，请再试一次。", "zh-TW": "設定未儲存，請再試一次。" },
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
