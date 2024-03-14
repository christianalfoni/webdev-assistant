import { useEffect, useRef } from "react";
import type { AssistantAction, ChatMessage } from "../src/types";
// @ts-ignore
import Markdown from "react-markdown";
import { Terminal } from "xterm";
import { useChatPanelMessages } from "./messaging";

function CogIcon() {
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
        d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
      />
    </svg>
  );
}

function CheckIcon() {
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
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}

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

function CodeIcon() {
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
        d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
      />
    </svg>
  );
}

function TerminalCommand({
  action,
  onInput,
  onExit,
  onKeep,
}: {
  action: AssistantAction & { type: "run_terminal_command" };
  onInput: (input: string) => void;
  onExit: () => void;
  onKeep: () => void;
}) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (terminalContainerRef.current) {
      const term = new Terminal({
        cols: 80,
        rows: 10,
        convertEol: true,
      });
      termRef.current = term;
      term.open(terminalContainerRef.current);
      term.onData(onInput);
    }
  }, []);

  useChatPanelMessages((message) => {
    if (
      message.type === "terminal_output" &&
      action.id === message.id &&
      termRef.current
    ) {
      termRef.current.write(message.data);
    }
  });

  useEffect(() => {
    if (termRef.current) {
      const term = termRef.current;
      action.buffer.forEach((data) => {
        term.write(data);
      });
    }
  }, []);

  return (
    <div className="action-wrapper">
      <div className="action-header">
        <CommandLineIcon /> {action.command}
        {action.status === "pending" ? <CogIcon /> : <CheckIcon />}
      </div>
      <div ref={terminalContainerRef} />
      {action.status === "pending" ? (
        <div className="action-buttons">
          <button onClick={onKeep}>Keep</button>
          <button onClick={onExit}>Exit</button>
        </div>
      ) : null}
    </div>
  );
}

export function ChatMessage({
  message,
  onTerminalInput,
  onTerminalExit,
  onKeepTerminal,
}: {
  message: ChatMessage;
  onTerminalInput: (actionId: string, input: string) => void;
  onTerminalExit: (actionId: string) => void;
  onKeepTerminal: (actionId: string) => void;
}) {
  const isAssistantAwaitingActions =
    message.role === "assistant" &&
    message.actions.find((action) => action.status === "pending");

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
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Writing file " + action.path}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "delete_file_or_directory": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Deleting " + action.path}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "read_directory": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Reading directory " + action.path}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "read_file": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Reading file " + action.path}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "read_terminal_outputs": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Reading terminal outputs"}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "run_terminal_command": {
                  return (
                    <TerminalCommand
                      action={action}
                      onInput={(input) => onTerminalInput(action.id, input)}
                      onExit={() => onTerminalExit(action.id)}
                      onKeep={() => onKeepTerminal(action.id)}
                    />
                  );
                }
                case "search_code_embeddings": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Searching CODE embeddings for " + action.query}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "search_doc_embeddings": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Searching DOC embeddings for " + action.query}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
                case "search_file_paths": {
                  return (
                    <div className="action-wrapper">
                      <div className="action-header">
                        <CodeIcon />
                        {"Searching file paths for " + action.path}
                        {action.status === "pending" ? (
                          <CogIcon />
                        ) : (
                          <CheckIcon />
                        )}
                      </div>
                    </div>
                  );
                }
              }
            })}
          </ul>
        ) : null}
        {message.text ? (
          <Markdown>{message.text}</Markdown>
        ) : isAssistantAwaitingActions ? (
          "Waiting..."
        ) : (
          "Thinking..."
        )}
      </div>
    </div>
  );
}
