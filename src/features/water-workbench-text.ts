import type { CanvasCreationEntryLanguage } from "./canvas-creation-entry-text";
export const WATER_WORKBENCH_TEXT = {
  "previewHelp": {"en": "Move the pointer over the water to try the boat speed. Water sound can be heard while adjusting.", "zh-CN": "把鼠标移到水面上体验船速；调整水声时可直接试听。", "zh-TW": "將游標移到水面體驗船速；調整水聲時可直接試聽。"},
  "launchpadPreviewDesc": {"en": "Preview changes to the launchpad.", "zh-CN": "预览启动台的调整效果。", "zh-TW": "預覽啟動台的調整效果。"},
  "launchpadPreview": {"en": "Launchpad preview", "zh-CN": "启动台预览", "zh-TW": "啟動台預覽"},
  "canvasPreview": {"en": "Canvas preview", "zh-CN": "画布预览", "zh-TW": "畫布預覽"},
  "canvasPreviewDesc": {"en": "Preview water and water mark size without changing a Canvas.", "zh-CN": "即时预览水面和水纹大小，不修改画布。", "zh-TW": "即時預覽水面和水紋大小，不修改畫布。"},
  "canvasPreviewNode": {"en": "Your thought", "zh-CN": "你的想法", "zh-TW": "你的想法"},
  "previewThought": {"en": "Drop a thought", "zh-CN": "投入想法", "zh-TW": "投入想法"},
  "previewPlaceholder": {"en": "What is on your mind?", "zh-CN": "随便说说，你想到什么了？", "zh-TW": "隨意說說，你想到什麼了？"},
  "previewEnter": {"en": "Enter", "zh-CN": "回车", "zh-TW": "Enter"},

} as const;
export type WaterWorkbenchTextKey = keyof typeof WATER_WORKBENCH_TEXT;
export function waterWorkbenchText(language: CanvasCreationEntryLanguage, key: WaterWorkbenchTextKey): string {
  return WATER_WORKBENCH_TEXT[key][language];
}
