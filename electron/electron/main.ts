import { app, BrowserView, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import { ElectronApi } from "./ElectronApi";
import { Editor } from "./Editor";

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
    },
    height: 768,
    width: 1024,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "..", "..", "index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  /*
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "preload-webview.js"),
    },
  });
  mainWindow.setBrowserView(view);
  view.setBounds({ x: 0, y: 0, width: 500, height: 300 });
  view.webContents.loadURL("http://localhost:5173");
  console.log("Listening for console messages");
  view.webContents.on("console-message", (...args) => {
    console.log("GOTZ MESSAGE", args);
  });
  view.webContents.openDevTools();
  */

  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const mainWindow = createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  const electronApi = new ElectronApi(ipcMain, mainWindow);
  const editor = Editor.create(electronApi, mainWindow);

  app.on("quit", () => {
    editor.dispose();
  });

  process.on("SIGINT", () => {
    app.quit();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
