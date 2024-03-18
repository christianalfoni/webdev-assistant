import { contextBridge, ipcRenderer } from "electron/renderer";
import { EditorClientState } from "../electron/types";
import { ChatMessage, EmbedderState } from "../electron/workspace/types";
import { IpcRendererEvent } from "electron";
import { ApiMessage } from "../electron/apiMessages";

contextBridge.exposeInMainWorld("electronAPI", {
  openWorkspace() {
    ipcRenderer.send(ApiMessage.OPEN_WORKSPACE);
  },
  getEditorState(): Promise<EditorClientState> {
    return ipcRenderer.invoke(ApiMessage.GET_EDITOR_STATE);
  },
  onEditorStateUpdated(cb: (editorState: EditorClientState) => void) {
    const listener = (_: IpcRendererEvent, editorState: EditorClientState) =>
      cb(editorState);

    ipcRenderer.on(ApiMessage.EDITOR_STATE_UPDATED, listener);

    return () => {
      ipcRenderer.off(ApiMessage.EDITOR_STATE_UPDATED, listener);
    };
  },
  sendAssistantMessage(message: string) {
    ipcRenderer.send(ApiMessage.SEND_ASSISTANT_MESSAGE, message);
  },
  getMessages(): Promise<ChatMessage[]> {
    return ipcRenderer.invoke(ApiMessage.GET_MESSAGES);
  },
  inputTerminal(actionId: string, input: string) {
    ipcRenderer.send(ApiMessage.INPUT_TERMINAL, actionId, input);
  },
  killTerminal(actionId: string) {
    ipcRenderer.send(ApiMessage.KILL_TERMINAL, actionId);
  },
  keepTerminal(actionId: string) {
    ipcRenderer.send(ApiMessage.KEEP_TERMINAL, actionId);
  },
  getEmbedderState(): Promise<EmbedderState> {
    return ipcRenderer.invoke(ApiMessage.GET_MESSAGES);
  },
  onTerminalOutput(
    cb: (terminalOutput: { actionId: string; output: string }) => void
  ) {
    const listener = (
      _: IpcRendererEvent,
      terminalOutput: { actionId: string; output: string }
    ) => cb(terminalOutput);

    ipcRenderer.on(ApiMessage.TERMINAL_OUTPUT, listener);

    return () => {
      ipcRenderer.off(ApiMessage.TERMINAL_OUTPUT, listener);
    };
  },
  onMessagesUpdated(cb: (messages: ChatMessage[]) => void) {
    const listener = (_: IpcRendererEvent, messages: ChatMessage[]) =>
      cb(messages);

    ipcRenderer.on(ApiMessage.MESSAGES_UPDATED, listener);

    return () => {
      ipcRenderer.off(ApiMessage.MESSAGES_UPDATED, listener);
    };
  },
  onEmbedderStateUpdated(cb: (embedderState: EmbedderState) => void) {
    const listener = (_: IpcRendererEvent, embedderState: EmbedderState) =>
      cb(embedderState);

    ipcRenderer.on(ApiMessage.EMBEDDER_STATE_UPDATED, listener);

    return () => {
      ipcRenderer.off(ApiMessage.EMBEDDER_STATE_UPDATED, listener);
    };
  },
});
