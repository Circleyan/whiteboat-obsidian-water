/** Home belongs to the main workspace, even while a settings popout is focused. */
export function openCanvasCreationEntryInMainWindow(
  entry: { open(): void },
  mainWindow: Window = window,
): void {
  const previousWindow = mainWindow.activeWindow;
  const previousDocument = mainWindow.activeDocument;
  try {
    // Modal.open() chooses its owner synchronously from these Obsidian globals.
    // Moving its DOM afterward leaves focus, Escape and cleanup in the wrong window.
    mainWindow.activeWindow = mainWindow;
    mainWindow.activeDocument = mainWindow.document;
    entry.open();
  } finally {
    mainWindow.activeWindow = previousWindow;
    mainWindow.activeDocument = previousDocument;
  }
}
