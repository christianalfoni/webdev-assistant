import { useState } from "react";
import { EmbedderState } from "../../../electron/workspace/types";

type Props = {
  onSendMessage: (text: string) => void;
  embedderState: EmbedderState;
  isConnectedToRuntime: boolean;
};

export function NewChatMessage({
  onSendMessage,
  embedderState,
  isConnectedToRuntime,
}: Props) {
  const [text, setText] = useState("");

  return (
    <div className="chat-message-wrapper">
      <div className="chat-message-avatar">
        <img
          alt="avatar"
          src="https://avatars.githubusercontent.com/u/3956929?v=4"
        />
      </div>
      <textarea
        placeholder="Please ask something..."
        className="new-chat-message"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.metaKey && event.key === "Enter") {
            onSendMessage(text);
            setText("");
          }
        }}
      ></textarea>
      <div className="embedder-state">
        {embedderState === "CREATING"
          ? "Creating embeddings..."
          : embedderState === "UPDATING"
          ? "Updating embeddings..."
          : "Embeddings ready!"}
      </div>
      <div className="runtime-state">
        {isConnectedToRuntime ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
}
