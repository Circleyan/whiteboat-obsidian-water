import anchorSvg from "../assets/canvas-entry-anchor.svg";

function svgDataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

/** Shared, unbranded submit mark used by water-surface composers. */
export const CANVAS_CREATION_ANCHOR_ASSET = svgDataUrl(anchorSvg);

/** Reuse the composer anchor, with a light edge for both water themes. */
export const CANVAS_CREATION_ANCHOR_CURSOR = svgDataUrl(
  anchorSvg
    .replace('width="16" height="16"', 'width="24" height="24"')
    .replace('viewBox="0 0 16 16"', 'viewBox="-2 -2 20 20"')
    .replace('<path ', '<path stroke="#f5f5f5" stroke-width="1" paint-order="stroke" '),
);
