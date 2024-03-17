import type { BrowserWindow, IpcMain, IpcRenderer } from "electron";

export enum ElectronApiMessage {
  OPEN_WORKSPACE = "OPEN_WORKSPACE",
}

export class ElectronApi {
  constructor(private ipcMain: IpcMain, private browserWindow: BrowserWindow) {}
  handleOpenWorkspace(cb: () => void) {
    console.log("WTF?!?!");
    this.ipcMain.on(ElectronApiMessage.OPEN_WORKSPACE, cb);
  }
}

/**
 * The object is transformed by Electron and need to only have instance properties
 */
export class ElectronRendererApi {
  constructor(private ipcRenderer: IpcRenderer) {}
  openWorkspace = (): void => {
    console.log("WHAT THE?!?");
    this.ipcRenderer.send(ElectronApiMessage.OPEN_WORKSPACE);
  };
}
