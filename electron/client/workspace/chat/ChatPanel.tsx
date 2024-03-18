import { NewChatMessage } from "./NewChatMessage";
import { ChatMessage } from "./ChatMessage";
import { useChatStore } from "./chatStore";
import { useEditorStore } from "../../editorStore";

export function ChatPanel() {
  const { api } = useEditorStore();
  const { messages, embedderState } = useChatStore();

  return (
    <div className="chat-messages">
      <div className="chat-messages-pusher" />
      {messages.map((message, index) => (
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
      ))}
      <NewChatMessage
        onSendMessage={(text) => {
          api.sendAssistantMessage(text);
        }}
        embedderState={embedderState}
        isConnectedToRuntime={false}
      />
    </div>
  );
}
