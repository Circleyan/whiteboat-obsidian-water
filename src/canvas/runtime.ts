import type { ObsidianAppLike, RuntimeCanvasViewLike, RuntimeCanvasNodeLike } from "./types";

// Read only the newly created native Canvas to align the water-entry reveal.
export class CanvasRuntimeAdapter {
  constructor(private readonly app: ObsidianAppLike) {}

  getActiveCanvasView(): RuntimeCanvasViewLike | null {
    const activeView = this.app.workspace?.activeLeaf?.view;
    if (this.isCanvasView(activeView)) {
      return activeView;
    }

    const recentView = this.app.workspace?.getMostRecentLeaf?.()?.view;
    if (this.isCanvasView(recentView)) {
      return recentView;
    }

    const canvasLeaf = this.app.workspace
      ?.getLeavesOfType?.("canvas")
      ?.find((leaf) => this.isCanvasView(leaf.view));
    const canvasView = canvasLeaf?.view;
    return this.isCanvasView(canvasView) ? canvasView : null;
  }


  getCanvasViewByPath(path: string): RuntimeCanvasViewLike | null {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return null;
    }
    const activeView = this.getActiveCanvasView();
    if (activeView?.file?.path === normalizedPath) {
      return activeView;
    }
    const matchingLeaf = this.app.workspace
      ?.getLeavesOfType?.("canvas")
      ?.find(
        (leaf) =>
          this.isCanvasView(leaf.view) &&
          leaf.view.file?.path === normalizedPath,
      );
    const matchingView = matchingLeaf?.view;
    return this.isCanvasView(matchingView) ? matchingView : null;
  }


  isCanvasView(view: unknown): view is RuntimeCanvasViewLike {
    const candidate = view as RuntimeCanvasViewLike | null;
    if (!candidate) {
      return false;
    }

    if (candidate.getViewType?.() === "canvas") {
      return true;
    }
    return Boolean(
      candidate.canvas && candidate.file?.path?.endsWith(".canvas"),
    );
  }


  getRuntimeNodeId(node: unknown): string | null {
    const data = this.getRuntimeNodeData(node);
    if (typeof data?.id === "string" && data.id) {
      return data.id;
    }

    const fallbackId = (node as RuntimeCanvasNodeLike | null)?.id;
    return typeof fallbackId === "string" && fallbackId ? fallbackId : null;
  }


  getRuntimeNodeData(node: unknown): Record<string, unknown> | null {
    if (!this.isRuntimeNode(node)) {
      return null;
    }

    try {
      return node.getData?.() ?? null;
    } catch {
      return null;
    }
  }


  findRuntimeNodeById(
    canvasView: RuntimeCanvasViewLike | null,
    nodeId: string,
  ): RuntimeCanvasNodeLike | null {
    return (
      this.getCanvasNodes(canvasView).find(
        (node) => this.getRuntimeNodeId(node) === nodeId,
      ) ?? null
    );
  }


  getCanvasNodes(
    canvasView: RuntimeCanvasViewLike | null,
  ): RuntimeCanvasNodeLike[] {
    const nodes = canvasView?.canvas?.nodes;
    if (nodes instanceof Map) {
      return Array.from(nodes.values()).filter((node) =>
        this.isRuntimeNode(node),
      );
    }
    if (nodes instanceof Set) {
      return Array.from(nodes.values()).filter((node) =>
        this.isRuntimeNode(node),
      );
    }
    if (Array.isArray(nodes)) {
      return nodes.filter((node) => this.isRuntimeNode(node));
    }
    if (nodes && typeof nodes === "object") {
      return Object.values(nodes).filter((node) => this.isRuntimeNode(node));
    }
    return [];
  }


  isRuntimeNode(node: unknown): node is RuntimeCanvasNodeLike {
    return Boolean(
      node &&
      typeof node === "object" &&
      typeof (node as RuntimeCanvasNodeLike).getData === "function",
    );
  }

}
