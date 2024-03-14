import { useEffect, useState } from "react";
import {
  ChatPanelClientMessage,
  ChatPanelClientState,
  ChatPanelMessage,
} from "../src/types";
import { NewChatMessage } from "./NewChatMessage";
import { ChatMessage } from "./ChatMessage";

const vscode = acquireVsCodeApi();

function postMessage(message: ChatPanelClientMessage) {
  vscode.postMessage(message);
}

export function ChatPanel() {
  const [state, setState] = useState<ChatPanelClientState | undefined>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<ChatPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "state_update":
          setState(message.state);
          break;
      }
    };

    window.addEventListener("message", onMessage);

    postMessage({
      type: "state_request",
    });

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (!state) {
    return null;
  }

  if (state.status === "NO_WORKSPACE") {
    return <h1>No workspace</h1>;
  }

  if (state.status === "MISSING_CONFIG") {
    // Detect config or click button to update
    return <h1>Missing config!</h1>;
  }

  if (state.status === "LOADING_EMBEDDINGS") {
    return <h1>Loading embeddings!</h1>;
  }

  if (state.status === "ERROR") {
    return <h1>Error! ${state.error}</h1>;
  }

  return (
    <div className="chat-messages">
      <div className="chat-messages-pusher" />
      {state.messages.map((message, index) => (
        <ChatMessage
          key={index}
          message={message}
          onTerminalInput={(actionId: string, input: string) => {
            postMessage({
              type: "terminal_input",
              actionId,
              input,
            });
          }}
          onTerminalExit={(actionId: string) => {
            postMessage({
              type: "terminal_kill",
              actionId,
            });
          }}
        />
      ))}
      <NewChatMessage
        onSendMessage={(text) => {
          postMessage({
            type: "assistant_request",
            text,
          });
        }}
      />
    </div>
  );
}
