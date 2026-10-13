/** Shared rendering states. Hosts include this recipe alongside their water CSS. */
export const CANVAS_CREATION_WATER_PRESENTATION_CSS = `
.wb-water-css-probe {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  height: 0;
}
[data-wb-water-impact-covered] {
  visibility: hidden !important;
}
`;

export const CANVAS_CREATION_WATER_CSS_PROBE_CLASS = "wb-water-css-probe";
