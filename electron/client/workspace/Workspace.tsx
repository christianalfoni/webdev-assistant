import { ChatPanel } from "./chat/ChatPanel";
import { ChatStoreProvider } from "./chat/chatStore";
import { useWorkspaceStore } from "./workspaceStore";

export function Workspace() {
  const { messages, embedderState } = useWorkspaceStore();

  if (messages.status === "rejected") {
    return <h1>Could not load messages, {String(messages.reason)}</h1>;
  }

  if (embedderState.status === "rejected") {
    return (
      <h1>Could not load embedder state, {String(embedderState.reason)}</h1>
    );
  }

  if (messages.status === "pending" || embedderState.status === "pending") {
    return <h1>Loading chat panel...</h1>;
  }

  console.log(messages.value);

  return (
    <ChatStoreProvider
      messages={messages.value}
      embedderState={embedderState.value}
    >
      <ChatPanel />
    </ChatStoreProvider>
  );
}
