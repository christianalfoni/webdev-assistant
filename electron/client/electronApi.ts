import type { ElectronRendererApi } from "../electron/ElectronApi";

export const electronAPI = (window as any).electronAPI as ElectronRendererApi;
