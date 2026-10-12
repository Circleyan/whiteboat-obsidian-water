export interface CanvasVaultFile {
  path: string;
  name?: string;
  basename?: string;
  extension?: string;
}

export interface CanvasNodeData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  [key: string]: unknown;
}

export interface CanvasTextNodeData extends CanvasNodeData {
  type: "text";
  text: string;
}

export interface CanvasGroupNodeData extends CanvasNodeData {
  type: "group";
  label?: string;
}

export interface CanvasEdgeData {
  id: string;
  fromNode?: string;
  toNode?: string;
  [key: string]: unknown;
}

export interface CanvasFileData {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
  [key: string]: unknown;
}

export interface RuntimeRectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface RuntimeElementLike {
  isConnected?: boolean;
  getBoundingClientRect?: () => RuntimeRectLike;
}

export interface RuntimeCanvasNodeLike {
  id?: string;
  getData?: () => Record<string, unknown>;
  setData?: (data: Record<string, unknown>, addHistory?: boolean) => void;
  moveAndResize?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  moveTo?: (position: { x: number; y: number }) => void;
  markMoved?: () => void;
  attach?: () => void;
  render?: () => void;
  startEditing?: () => void;
  canvas?: RuntimeCanvasLike;
  isEditing?: boolean;
  nodeEl?: RuntimeElementLike;
  contentEl?: RuntimeElementLike;
  containerEl?: RuntimeElementLike;
  el?: RuntimeElementLike;
  child?: {
    nodeEl?: RuntimeElementLike;
    contentEl?: RuntimeElementLike;
    containerEl?: RuntimeElementLike;
    el?: RuntimeElementLike;
    editMode?: unknown;
  };
}

export interface RuntimeCanvasEdgeEndLike {
  node?: RuntimeCanvasNodeLike;
  side?: unknown;
  end?: unknown;
  [key: string]: unknown;
}

export interface RuntimeCanvasEdgeLike {
  id?: string;
  from?: RuntimeCanvasEdgeEndLike;
  to?: RuntimeCanvasEdgeEndLike;
  getData?: () => Record<string, unknown>;
  setData?: (data: Record<string, unknown>, addHistory?: boolean) => void;
  update?: (
    from: RuntimeCanvasEdgeEndLike,
    to: RuntimeCanvasEdgeEndLike,
  ) => void;
}

export interface RuntimeCanvasLike {
  createGroupNode?: (
    options: Record<string, unknown>,
  ) => RuntimeCanvasNodeLike | null;
  createTextNode?: (
    options: Record<string, unknown>,
  ) => RuntimeCanvasNodeLike | null;
  createFileNode?: (
    options: Record<string, unknown>,
  ) => RuntimeCanvasNodeLike | null;
  createLinkNode?: (
    options: Record<string, unknown>,
  ) => RuntimeCanvasNodeLike | null;
  config?: {
    defaultTextNodeDimensions?: CanvasTextNodeSizeLike;
    [key: string]: unknown;
  };
  importData?: (
    data: { nodes: CanvasNodeData[]; edges: CanvasEdgeData[] },
    center?: boolean,
    select?: boolean,
  ) => void | Promise<void>;
  removeNode?: (node: RuntimeCanvasNodeLike) => void;
  removeEdge?: (edge: RuntimeCanvasEdgeLike) => void;
  getData?: () => Record<string, unknown>;
  requestSave?: () => void;
  markDirty?: (element?: unknown) => void;
  requestFrame?: () => void;
  deselectAll?: () => void;
  selectOnly?: (element: unknown) => void;
  zoomToSelection?: () => void;
  selection?: Set<unknown>;
  nodes?:
    | Map<string, RuntimeCanvasNodeLike>
    | Set<RuntimeCanvasNodeLike>
    | RuntimeCanvasNodeLike[]
    | Record<string, RuntimeCanvasNodeLike>;
  edges?:
    | Map<string, RuntimeCanvasEdgeLike>
    | Set<RuntimeCanvasEdgeLike>
    | RuntimeCanvasEdgeLike[]
    | Record<string, RuntimeCanvasEdgeLike>;
  menu?: {
    menuEl?: HTMLElement | null;
  } | null;
  nodeInteractionLayer?: {
    setTarget?: (node: RuntimeCanvasNodeLike | null) => void;
  };
  containerEl?: RuntimeElementLike;
  wrapperEl?: RuntimeElementLike;
}

export interface CanvasTextNodeSizeLike {
  width: number;
  height: number;
}

export interface RuntimeCanvasViewLike {
  file?: CanvasVaultFile;
  canvas?: RuntimeCanvasLike;
  getViewType?: () => string;
  containerEl?: RuntimeElementLike;
  contentEl?: RuntimeElementLike;
}

export interface WorkspaceLeafLike {
  id?: string | null;
  view?: unknown;
  openFile?: (file: CanvasVaultFile) => Promise<void> | void;
}

export interface WorkspaceLike {
  activeLeaf?: WorkspaceLeafLike | null;
  getActiveFile?: () => CanvasVaultFile | null;
  getLeavesOfType?: (viewType: string) => WorkspaceLeafLike[];
  getMostRecentLeaf?: () => WorkspaceLeafLike | null;
  getLeaf?: (newLeaf?: boolean) => WorkspaceLeafLike | null;
}

export interface VaultLike {
  getName?: () => string;
  getAbstractFileByPath?: (path: string) => CanvasVaultFile | null;
  getFiles?: () => CanvasVaultFile[];
  read?: (file: CanvasVaultFile) => Promise<string>;
  modify?: (file: CanvasVaultFile, content: string) => Promise<void>;
}

export interface MetadataCacheLike {
  getFirstLinkpathDest?: (
    linkpath: string,
    sourcePath: string,
  ) => CanvasVaultFile | null;
}

export interface ObsidianAppLike {
  workspace?: WorkspaceLike;
  vault?: VaultLike;
  metadataCache?: MetadataCacheLike;
}
