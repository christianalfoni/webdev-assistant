import type { ChatMessage } from "../src/types";
// @ts-ignore
import Markdown from "react-markdown";

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
        {message.role === "assistant" && message.actions.length ? (
          <ul>
            {message.actions.map((action) => {
              let label: string;

              switch (action.type) {
                case "write_file": {
                  label = "Writing file: " + action.path;
                  break;
                }
                case "delete_file": {
                  label = "Deleting file: " + action.path;
                  break;
                }
                case "read_directory": {
                  label = "Reading directory: " + action.path;
                  break;
                }
                case "read_file": {
                  label = "Reading file: " + action.path;
                  break;
                }
                case "run_terminal_command": {
                  label = "Running terminal command: " + action.command;
                  break;
                }
                case "search_code_embeddings": {
                  label = "Searching CODE embeddings: " + action.query;
                  break;
                }
                case "search_doc_embeddings": {
                  label = "Searching DOC embeddings: " + action.query;
                  break;
                }
                case "search_file_paths": {
                  label = "Searching file paths: " + action.path;
                  break;
                }
              }

              return <li>{label}</li>;
            })}
          </ul>
        ) : null}
        {message.text ? <Markdown>{message.text}</Markdown> : "Thinking..."}
      </div>
    </div>
  );
}
