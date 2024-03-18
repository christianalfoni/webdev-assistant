import { createStoreProvider, signal, useStore } from "impact-react";
import { useEditorStore } from "../editorStore";

function WorkspaceStore() {
  const editorStore = useEditorStore();
  const messages = signal(editorStore.api.getMessages());
  const embedderState = signal(editorStore.api.getEmbedderState());

  return {
    get messages() {
      return messages.value;
    },
    get embedderState() {
      return embedderState.value;
    },
  };
}

export const useWorkspaceStore = () => useStore(WorkspaceStore);

export const WorkspaceStoreProvider = createStoreProvider(WorkspaceStore);
