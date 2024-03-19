import { useChatStore } from "./chatStore";
import { useEditorStore } from "../../editorStore";
import { classNames } from "../../utils";
import { useEffect, useRef, useState } from "react";
// @ts-ignore
import Markdown from "react-markdown";
import { AssistantAction } from "../../../electron/workspace/types";
import { CheckCircleIcon } from "@heroicons/react/16/solid";
import { Terminal } from "xterm";

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
  const { api } = useEditorStore();
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
      term.writeln(action.command);
      term.onData(onInput);
    }
  }, []);

  useEffect(
    () =>
      api.onTerminalOutput(({ actionId, output }) => {
        if (actionId === action.id && termRef.current) {
          termRef.current.write(output);
        }
      }),
    [action.id]
  );

  useEffect(() => {
    if (termRef.current) {
      const term = termRef.current;
      action.buffer.forEach((data) => {
        term.write(data);
      });
    }
  }, []);

  return (
    <div className="flex-auto py-0.5 text-sm leading-5 text-gray-400 h-60 w-full overflow-x-hidden">
      <div
        className="flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200 bg-black"
        ref={terminalContainerRef}
      />
    </div>
  );
}

function ChatItem({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-x-4">
      <div
        className={classNames(
          className,
          "absolute left-0 top-0 flex w-6 justify-center"
        )}
      >
        <div className="w-px bg-gray-200" />
      </div>
      {children}
    </li>
  );
}

function ChatAction({ action }: { action: AssistantAction }) {
  const { api } = useEditorStore();

  let content;

  switch (action.type) {
    case "write_file": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">Write file</span>{" "}
          {action.path}.
        </p>
      );
      break;
    }
    case "delete_file_or_directory": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">Delete </span>{" "}
          {action.path}.
        </p>
      );
      break;
    }
    case "read_directory": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">Read directory</span>{" "}
          {action.path}.
        </p>
      );
      break;
    }
    case "read_file": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">Read file</span>{" "}
          {action.path}.
        </p>
      );
      break;
    }
    case "read_development_logs": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">
            Read development logs
          </span>
        </p>
      );
      break;
    }
    case "run_terminal_command": {
      content = (
        <TerminalCommand
          action={action}
          onInput={(input) => api.inputTerminal(action.id, input)}
          onExit={() => api.killTerminal(action.id)}
          onKeep={() => api.keepTerminal(action.id)}
        />
      );
      break;
    }
    case "search_code_embeddings": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">
            Search code embeddings
          </span>{" "}
          {action.query}.
        </p>
      );
      break;
    }
    case "search_doc_embeddings": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">
            Search doc embeddings
          </span>{" "}
          {action.query}.
        </p>
      );
      break;
    }
    case "search_file_paths": {
      content = (
        <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
          <span className="font-medium text-gray-900">Search file paths</span>{" "}
          {action.path}.
        </p>
      );
      break;
    }
  }

  return (
    <>
      <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-white">
        {action.status === "resolved" ? (
          <CheckCircleIcon
            className="h-6 w-6 text-green-600"
            aria-hidden="true"
          />
        ) : action.status === "rejected" ? (
          <CheckCircleIcon
            className="h-6 w-6 text-red-600"
            aria-hidden="true"
          />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-gray-100 ring-1 ring-gray-300" />
        )}
      </div>
      {content}
    </>
  );
}

function ChatMessage({
  avatarSrc,
  message,
  role,
}: {
  avatarSrc: string;
  message: string;
  role: string;
}) {
  return (
    <>
      <img
        src={avatarSrc}
        alt=""
        className="relative mt-3 h-6 w-6 flex-none rounded-full bg-gray-50"
      />
      <div className="flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200">
        <div className="flex justify-between gap-x-4">
          <div className="py-0.5 text-xs leading-5 text-gray-500">
            <span className="font-medium text-gray-900">{role}</span>{" "}
            {role === "user" ? "asking" : "answering"}
          </div>
        </div>
        <div className="prose text-sm leading-6 text-gray-500">
          <Markdown>{message}</Markdown>
        </div>
      </div>
    </>
  );
}

function NewChatMessage({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [text, setText] = useState("");

  return (
    <div className="mt-6 flex gap-x-3">
      <img
        src="https://avatars.githubusercontent.com/u/3956929?v=4"
        alt=""
        className="h-6 w-6 flex-none rounded-full bg-gray-50"
      />
      <form className="relative flex-auto" onSubmit={() => onSubmit(text)}>
        <div className="overflow-hidden rounded-lg pb-12 shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-indigo-600">
          <label htmlFor="comment" className="sr-only">
            Add your comment
          </label>
          <textarea
            rows={2}
            name="comment"
            id="comment"
            className="block w-full resize-none border-0 bg-transparent py-1.5 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
            placeholder="Write message..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
          <button
            type="submit"
            className="ml-auto rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Send message
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChatPanel() {
  const { api } = useEditorStore();
  const { messages, embedderState } = useChatStore();

  return (
    <div className="p-10">
      <ul role="list" className="space-y-6">
        {messages.flatMap((message, index) => {
          const actions =
            message.role === "assistant"
              ? message.actions.map((action) => (
                  <ChatItem key={action.id} className="-bottom-6">
                    <ChatAction action={action} />
                  </ChatItem>
                ))
              : [];

          return actions.concat(
            <ChatItem
              key={index}
              className={index === messages.length - 1 ? "h-6" : "-bottom-6"}
            >
              <ChatMessage
                avatarSrc={
                  message.role === "user"
                    ? "https://avatars.githubusercontent.com/u/3956929?v=4"
                    : "https://avatars.githubusercontent.com/u/4183342?s=96&v=4"
                }
                message={message.text}
                role={message.role}
              />
            </ChatItem>
          );
        })}
      </ul>
      <NewChatMessage
        onSubmit={(message) => api.sendAssistantMessage(message)}
      />
    </div>
  );
}

/*
<ChatMessage
          key={index}
          message={message}
          onTerminalInput={(actionId: string, input: string) => {
            api.inputTerminal(actionId, input);
          }}
          onTerminalExit={(actionId: string) => {
            api.killTerminal(actionId);
          }}
          onKeepTerminal={(actionId: string) => {
            api.keepTerminal(actionId);
          }}
        />
        
        
              <NewChatMessage
        onSendMessage={(text) => {
          api.sendAssistantMessage(text);
        }}
        embedderState={embedderState}
        isConnectedToRuntime={false}
      />
*/
