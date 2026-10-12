import type { CanvasNodeData } from "../canvas/types";

export type CanvasSide = "top" | "right" | "bottom" | "left";

export interface CanvasRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTextNodeSize {
  width: number;
  height: number;
}

export const WHITEBOAT_DEFAULT_TEXT_NODE_SIZE: CanvasTextNodeSize = {
  width: 200,
  height: 40,
} as const;

export const WHITEBOAT_TEXT_NODE_SIZE_LIMITS = {
  minWidth: 120,
  maxWidth: 720,
  minHeight: 36,
  maxHeight: 420,
} as const;

export function normalizeTextNodeSize(
  value: unknown,
  fallback: CanvasTextNodeSize = WHITEBOAT_DEFAULT_TEXT_NODE_SIZE
): CanvasTextNodeSize {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const width = typeof candidate.width === "number" && Number.isFinite(candidate.width)
    ? candidate.width
    : fallback.width;
  const height = typeof candidate.height === "number" && Number.isFinite(candidate.height)
    ? candidate.height
    : fallback.height;

  return {
    width: Math.round(clamp(width, WHITEBOAT_TEXT_NODE_SIZE_LIMITS.minWidth, WHITEBOAT_TEXT_NODE_SIZE_LIMITS.maxWidth)),
    height: Math.round(clamp(height, WHITEBOAT_TEXT_NODE_SIZE_LIMITS.minHeight, WHITEBOAT_TEXT_NODE_SIZE_LIMITS.maxHeight)),
  };
}

export function normalizeCanvasSide(side: unknown): CanvasSide | null {
  return side === "top" || side === "right" || side === "bottom" || side === "left"
    ? side
    : null;
}

export function getCanvasNodeCenter(node: CanvasRectLike) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

export function getCanvasNodeMidpoint(fromNode: CanvasRectLike, toNode: CanvasRectLike) {
  const fromCenter = getCanvasNodeCenter(fromNode);
  const toCenter = getCanvasNodeCenter(toNode);
  return {
    x: (fromCenter.x + toCenter.x) / 2,
    y: (fromCenter.y + toCenter.y) / 2,
  };
}

export function inferSideFacingNeighbor(node: CanvasRectLike, neighbor: CanvasRectLike): CanvasSide {
  const nodeCenter = getCanvasNodeCenter(node);
  const neighborCenter = getCanvasNodeCenter(neighbor);
  const dx = neighborCenter.x - nodeCenter.x;
  const dy = neighborCenter.y - nodeCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }
  return dy < 0 ? "top" : "bottom";
}

export function isNodeCenterInsideGroup(node: CanvasNodeData, groupNode: CanvasNodeData): boolean {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  return (
    centerX >= groupNode.x &&
    centerX <= groupNode.x + groupNode.width &&
    centerY >= groupNode.y &&
    centerY <= groupNode.y + groupNode.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
