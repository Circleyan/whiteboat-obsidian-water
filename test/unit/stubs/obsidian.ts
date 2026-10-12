export function normalizePath(path: string): string {
  const normalized = String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//u, "");
  return normalized === "" ? "/" : normalized;
}

export function setIcon(): void {
  // Unit tests only need the pure contract functions from files that import obsidian.
}

export function setTooltip(): void {
  // Unit tests only need the pure contract functions from files that import obsidian.
}

export class Modal {
  app: unknown;
  contentEl = {} as HTMLElement;
  modalEl = {} as HTMLElement;
  containerEl = {} as HTMLElement;

  constructor(app: unknown) {
    this.app = app;
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {
    // Unit tests do not render Obsidian modals.
  }

  onClose(): void {
    // Unit tests do not render Obsidian modals.
  }
}

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: true,
  isWin: false,
  isLinux: false,
  isSafari: false,
};

export class Notice {
  message: string | DocumentFragment;
  duration?: number;

  constructor(message: string | DocumentFragment, duration?: number) {
    this.message = message;
    this.duration = duration;
  }

  setMessage(message: string | DocumentFragment): this {
    this.message = message;
    return this;
  }

  hide(): void {
    // no-op
  }
}

export class Plugin {
  app: unknown;
  manifest: { id: string };

  constructor(
    app: unknown = {},
    manifest: { id: string } = { id: "test-plugin" },
  ) {
    this.app = app;
    this.manifest = manifest;
  }

  register(): void {
    // no-op
  }

  registerEvent(): void {
    // no-op
  }

  registerInterval(): void {
    // no-op
  }

  addCommand(): void {
    // no-op
  }
}

export class TFile {
  path = "";
  name = "";
  basename = "";
  extension = "";
}

export function requestUrl(): Promise<unknown> {
  return Promise.resolve({});
}

export class Component {
  private loaded = false;
  load(): void { if (!this.loaded) { this.loaded = true; this.onload(); } }
  unload(): void { if (this.loaded) { this.loaded = false; this.onunload(); } }
  onload(): void {}
  onunload(): void {}
  registerEvent(): void {}
}
