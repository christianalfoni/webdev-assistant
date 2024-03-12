import { ToolCallType } from "../src/AssistantTools";
import { ChatMessage } from "../src/types";

export function ChatMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="chat-message-wrapper">
      <div className="chat-message-avatar">
        <img
          alt="avatar"
          src={
            message.role === "assistant"
              ? "https://avatars.githubusercontent.com/u/4183342?s=96&v=4"
              : "https://avatars.githubusercontent.com/u/3956929?v=4"
          }
        />
      </div>
      <div className="chat-message-text">
        {message.role === "assistant"
          ? message.actions.map((action) => {
              let label: string;

              switch (action.type) {
                case ToolCallType.WRITE_FILE: {
                  label = "Writing file: " + action.path;
                  break;
                }
                case ToolCallType.DELETE_FILE: {
                  label = "Deleting file: " + action.path;
                  break;
                }
                case ToolCallType.READ_DIRECTORY: {
                  label = "Reading directory: " + action.path;
                  break;
                }
                case ToolCallType.READ_FILE: {
                  label = "Reading file: " + action.path;
                  break;
                }
                case ToolCallType.RUN_TERMINAL_COMMAND: {
                  label = "Running terminal command: " + action.command;
                  break;
                }
                case ToolCallType.SEARCH_CODE_EMBEDDINGS: {
                  label = "Searching CODE embeddings: " + action.query;
                  break;
                }
                case ToolCallType.SEARCH_DOC_EMBEDDINGS: {
                  label = "Searching DOC embeddings: " + action.query;
                  break;
                }
                case ToolCallType.SEARCH_FILE_PATHS: {
                  label = "Searching file paths: " + action.path;
                  break;
                }
              }

              return <div>### {label}</div>;
            })
          : null}
        {message.text}
      </div>
    </div>
  );
}
