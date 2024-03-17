import { contextBridge, ipcRenderer } from "electron/renderer";
import { ElectronRendererApi } from "../electron/ElectronApi";

contextBridge.exposeInMainWorld(
  "electronAPI",
  new ElectronRendererApi(ipcRenderer)
);
