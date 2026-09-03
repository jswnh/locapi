import {
  screen,
  BrowserWindow,
  BrowserWindowConstructorOptions,
} from 'electron';
import Store from 'electron-store';

export interface WindowState {
  width: number;
  height: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions
): BrowserWindow => {
  const key = 'window-state';
  const name = `window-state-${windowName}`;
  const store = new Store<WindowState>({ name });

  // Get primary display work area (excludes taskbar/dock)
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  // Calculate intelligent responsive size that fits comfortably on any monitor
  const getResponsiveSize = (
    savedWidth?: number,
    savedHeight?: number
  ): { width: number; height: number } => {
    const minWidth = Math.min(options.minWidth || 680, workArea.width);
    const minHeight = Math.min(options.minHeight || 450, workArea.height);

    // Default sizing: ~82% of screen work area, capped at 1280x820
    const defaultWidth = Math.min(
      options.width || 1280,
      Math.max(minWidth, Math.round(workArea.width * 0.82))
    );
    const defaultHeight = Math.min(
      options.height || 820,
      Math.max(minHeight, Math.round(workArea.height * 0.82))
    );

    let width = savedWidth && savedWidth > 0 ? savedWidth : defaultWidth;
    let height = savedHeight && savedHeight > 0 ? savedHeight : defaultHeight;

    // Strict clamp to guarantee window never exceeds available monitor space
    width = Math.max(minWidth, Math.min(width, workArea.width));
    height = Math.max(minHeight, Math.min(height, workArea.height));

    return { width, height };
  };

  // Restore saved state
  let savedState: WindowState | null = null;
  try {
    savedState = store.get(key) as WindowState;
  } catch {
    savedState = null;
  }

  const { width, height } = getResponsiveSize(savedState?.width, savedState?.height);

  // When not fullscreen/maximized, ALWAYS appear centered on the monitor
  const x = workArea.x + Math.round((workArea.width - width) / 2);
  const y = workArea.y + Math.round((workArea.height - height) / 2);

  const shouldBeFullScreen = Boolean(savedState?.isFullScreen);
  const shouldBeMaximized = Boolean(savedState?.isMaximized);

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    center: true,
    show: false, // Prevent visual flicker while applying fullscreen/maximize
    minWidth: options.minWidth || 680,
    minHeight: options.minHeight || 450,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    ...options,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      ...options.webPreferences,
    },
  });

  // Apply saved fullscreen or maximized state before showing
  if (shouldBeFullScreen) {
    win.setFullScreen(true);
  } else if (shouldBeMaximized) {
    win.maximize();
  }

  // Gracefully show window once ready (or safety timeout)
  let hasShown = false;
  const showWindow = () => {
    if (!hasShown && !win.isDestroyed()) {
      hasShown = true;
      win.show();
    }
  };

  win.once('ready-to-show', showWindow);
  setTimeout(showWindow, 600);

  // State saving logic
  let normalSize = { width, height };

  const updateNormalSize = () => {
    if (!win.isDestroyed() && !win.isMinimized() && !win.isMaximized() && !win.isFullScreen()) {
      const size = win.getSize();
      normalSize = {
        width: size[0],
        height: size[1],
      };
    }
  };

  const saveState = () => {
    if (win.isDestroyed()) return;

    updateNormalSize();

    const stateToSave: WindowState = {
      width: normalSize.width,
      height: normalSize.height,
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    };

    try {
      store.set(key, stateToSave);
    } catch (err) {
      console.warn('[Window] Failed to save window state:', err);
    }
  };

  win.on('resize', saveState);
  win.on('maximize', saveState);
  win.on('unmaximize', () => {
    updateNormalSize();
    saveState();
  });
  win.on('enter-full-screen', saveState);
  win.on('leave-full-screen', () => {
    updateNormalSize();
    saveState();
  });
  win.on('close', saveState);

  // Support F11 keyboard shortcut for toggling fullscreen
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  return win;
};
