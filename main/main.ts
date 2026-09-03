import path from "path";
import { app, Menu } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { initDb } from "./db/client";
import { registerDbHandlers } from "./ipc/db-handlers";
import { registerEngineHandlers } from "./ipc/engine-handlers";
import { registerWorkspaceHandlers } from "./ipc/workspace-handlers";
import { registerWindowHandlers } from "./ipc/window-handlers";
import { registerDataHandlers } from "./ipc/data-handlers";
import { registerCookieHandlers } from "./ipc/cookie-handlers";

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

(async () => {
  await app.whenReady();

  // Set Windows Application User Model ID
  app.setAppUserModelId('com.jswnh.locapi');

  // Remove native menu bar
  Menu.setApplicationMenu(null);

  // Initialize SQLite database & seed default data
  initDb();

  // Register SQLite, Workspace, and Execution Engine IPC handlers
  registerDbHandlers();
  registerEngineHandlers();
  registerWorkspaceHandlers();
  registerCookieHandlers();

  const icoPath = path.join(import.meta.dirname, "../resources/icon.ico");
  const icnsPath = path.join(import.meta.dirname, "../resources/icon.icns");

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icnsPath);
  }

  const mainWindow = createWindow("main", {
    width: 1280,
    height: 800,
    minWidth: 680,
    minHeight: 450,
    icon: icoPath,
    title: "Locapi",
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Register window and data handlers with window reference
  registerWindowHandlers(mainWindow);
  registerDataHandlers(mainWindow);

  if (isProd) {
    await mainWindow.loadURL("app://./home");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
  }
})();

app.on("window-all-closed", () => {
  app.quit();
});
