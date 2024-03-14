import { useEffect } from "react";
import { ChatPanelClientMessage, ChatPanelMessage } from "../src/types";

const vscode = acquireVsCodeApi();

export function postChatPanelMessage(message: ChatPanelClientMessage) {
  vscode.postMessage(message);
}

export function useChatPanelMessages(cb: (message: ChatPanelMessage) => void) {
  useEffect(() => {
    const onMessage = (event: MessageEvent<ChatPanelMessage>) => {
      const message = event.data;

      cb(message);
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);
}
