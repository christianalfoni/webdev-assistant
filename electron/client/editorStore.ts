import { signal, useStore } from "impact-react";
import type { ElectronRendererApi } from "../electron/ElectronApi";

const electronAPI = (window as any).electronAPI as ElectronRendererApi;

function EditorStore() {
  const state = signal(electronAPI.getEditorState());

  electronAPI.onEditorStateUpdated((editorState) => {
    state.value = Promise.resolve(editorState);
  });

  return {
    get state() {
      return state.value;
    },
    openWorkspace() {
      electronAPI.openWorkspace();
    },
  };
}

export const useEditorStore = () => useStore(EditorStore);
