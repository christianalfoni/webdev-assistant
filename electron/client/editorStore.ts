import { Signal, signal, useStore } from "impact-react";
import type { ElectronRendererApi } from "../preload/preload";
import { ChatMessage, EmbedderState } from "../electron/workspace/types";

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
    get api() {
      return electronAPI;
    },
  };
}

export const useEditorStore = () => useStore(EditorStore);
