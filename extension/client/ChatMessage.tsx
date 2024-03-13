import { useEffect, useRef } from "react";
import type { AssistantAction, ChatMessage } from "../src/types";
// @ts-ignore
import Markdown from "react-markdown";
import { Terminal } from "xterm";

function CommandLineIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="action-icon"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function TerminalCommand({
  action,
}: {
  action: AssistantAction & { type: "run_terminal_command" };
}) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const bufferLengthRef = useRef(0);

  useEffect(() => {
    if (terminalContainerRef.current) {
      const term = new Terminal({
        cols: 80,
        rows: 10,
      });
      termRef.current = term;
      term.open(terminalContainerRef.current);
    }
  }, []);

  useEffect(() => {
    if (action.output && termRef.current) {
      const lines = action.output.split(/(\r?\n)/g);

      for (let x = bufferLengthRef.current; x < lines.length; x++) {
        termRef.current.write(lines[x] + "\r");
      }

      bufferLengthRef.current = lines.length - 1;
    }
  }, [action.output]);

  return (
    <div className="action-terminal">
      <div className="action-header">
        <CommandLineIcon /> {action.command}
      </div>
      <div ref={terminalContainerRef} />
    </div>
  );
}

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
              let label: React.ReactNode;

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
                  return <TerminalCommand action={action} />;
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
