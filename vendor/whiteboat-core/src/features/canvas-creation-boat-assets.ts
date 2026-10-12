import boatHullSvg from "../assets/canvas-entry-boat-hull.svg";
import boatShadowSvg from "../assets/canvas-entry-boat-shadow.svg";
import boatWindowSvg from "../assets/canvas-entry-boat-window.svg";

function svgDataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

/**
 * Shared, unbranded boat artwork for every Canvas-creation water surface.
 * Keep this module free of Whiteboat marks so ecosystem adapters can reuse the
 * boat without pulling branding into their client bundle.
 */
export const CANVAS_CREATION_BOAT_ASSETS = Object.freeze({
  boatHull: svgDataUrl(boatHullSvg),
  boatShadow: svgDataUrl(boatShadowSvg),
  boatWindow: svgDataUrl(boatWindowSvg),
});
