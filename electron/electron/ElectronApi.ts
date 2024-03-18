import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { Disposable } from "./workspace/utils";
import { EditorClientState } from "./types";
import { ChatMessage, EmbedderState } from "./workspace/types";
import { ApiMessage } from "./apiMessages";

export class ElectronApi {
  constructor(private ipcMain: IpcMain, private browserWindow: BrowserWindow) {}
  onOpenWorkspace(cb: () => void) {
    this.ipcMain.on(ApiMessage.OPEN_WORKSPACE, cb);

    return Disposable.create(() => {
      this.ipcMain.off(ApiMessage.OPEN_WORKSPACE, cb);
    });
  }
  handleGetEditorState(cb: () => EditorClientState) {
    this.ipcMain.handle(ApiMessage.GET_EDITOR_STATE, cb);

    return Disposable.create(() => {
      this.ipcMain.removeHandler(ApiMessage.GET_EDITOR_STATE);
    });
  }
  sendEditorState(editorState: EditorClientState) {
    this.browserWindow.webContents.send(
      ApiMessage.EDITOR_STATE_UPDATED,
      editorState
    );
  }
  onSendAssistantMessage(cb: (message: string) => void) {
    const listener = (_: IpcMainEvent, message: string) => cb(message);
    this.ipcMain.on(ApiMessage.SEND_ASSISTANT_MESSAGE, listener);

    return Disposable.create(() => {
      this.ipcMain.off(ApiMessage.SEND_ASSISTANT_MESSAGE, listener);
    });
  }
  handleGetMessages(cb: () => ChatMessage[]) {
    this.ipcMain.handle(ApiMessage.GET_MESSAGES, cb);

    return Disposable.create(() => {
      this.ipcMain.removeHandler(ApiMessage.GET_MESSAGES);
    });
  }
  onInputTerminal(cb: (actionId: string, input: string) => void) {
    const listener = (_: IpcMainEvent, actionId: string, input: string) =>
      cb(actionId, input);
    this.ipcMain.on(ApiMessage.INPUT_TERMINAL, listener);

    return Disposable.create(() => {
      this.ipcMain.off(ApiMessage.INPUT_TERMINAL, listener);
    });
  }
  onKillTerminal(cb: (actionId: string) => void) {
    const listener = (_: IpcMainEvent, actionId: string) => cb(actionId);
    this.ipcMain.on(ApiMessage.KILL_TERMINAL, listener);

    return Disposable.create(() => {
      this.ipcMain.off(ApiMessage.KILL_TERMINAL, listener);
    });
  }
  onKeepTerminal(cb: (actionId: string) => void) {
    const listener = (_: IpcMainEvent, actionId: string) => cb(actionId);
    this.ipcMain.on(ApiMessage.KEEP_TERMINAL, listener);

    return Disposable.create(() => {
      this.ipcMain.off(ApiMessage.KEEP_TERMINAL, listener);
    });
  }
  handleGetEmbedderState(cb: () => EmbedderState) {
    this.ipcMain.handle(ApiMessage.GET_EMBEDDER_STATE, cb);

    return Disposable.create(() => {
      this.ipcMain.removeHandler(ApiMessage.GET_EMBEDDER_STATE);
    });
  }
  sendTerminalOutput(actionId: string, output: string) {
    this.browserWindow.webContents.send(
      ApiMessage.TERMINAL_OUTPUT,
      actionId,
      output
    );
  }
  sendMessages(messages: ChatMessage[]) {
    this.browserWindow.webContents.send(ApiMessage.MESSAGES_UPDATED, messages);
  }
  sendEmbedderState(embedderState: EmbedderState) {
    this.browserWindow.webContents.send(
      ApiMessage.EMBEDDER_STATE_UPDATED,
      embedderState
    );
  }
}
