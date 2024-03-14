import { useEffect, useState } from "react";
import { ChatPanelClientState } from "../src/types";
import { NewChatMessage } from "./NewChatMessage";
import { ChatMessage } from "./ChatMessage";
import { postChatPanelMessage, useChatPanelMessages } from "./messaging";

export function ChatPanel() {
  const [state, setState] = useState<ChatPanelClientState | undefined>();

  useEffect(() => {
    postChatPanelMessage({
      type: "state_request",
    });
  }, []);

  useChatPanelMessages((message) => {
    if (message.type === "state_update") {
      setState(message.state);
    }
  });

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
            postChatPanelMessage({
              type: "terminal_input",
              actionId,
              input,
            });
          }}
          onTerminalExit={(actionId: string) => {
            postChatPanelMessage({
              type: "terminal_kill",
              actionId,
            });
          }}
        />
      ))}
      <NewChatMessage
        onSendMessage={(text) => {
          postChatPanelMessage({
            type: "assistant_request",
            text,
          });
        }}
        embedderState={state.embedderState}
      />
    </div>
  );
}
