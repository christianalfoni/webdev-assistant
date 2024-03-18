import { cleanup, createStoreProvider, signal, useStore } from "impact-react";
import { ChatMessage, EmbedderState } from "../../../electron/workspace/types";
import { useEditorStore } from "../../editorStore";

type Props = {
  messages: ChatMessage[];
  embedderState: EmbedderState;
};

function ChatStore(props: Props) {
  const editorStore = useEditorStore();
  const messages = signal(props.messages);
  const embedderState = signal(props.embedderState);

  const disposeOnMessagesUpdated = editorStore.api.onMessagesUpdated(
    (updatedMessages) => {
      messages.value = updatedMessages;
    }
  );
  const disposeOnEmbedderStateUpdated = editorStore.api.onEmbedderStateUpdated(
    (updatedEmbedderState) => {
      embedderState.value = updatedEmbedderState;
    }
  );

  cleanup(() => {
    disposeOnMessagesUpdated();
    disposeOnEmbedderStateUpdated();
  });

  return {
    get messages() {
      return messages.value;
    },
    get embedderState() {
      return embedderState.value;
    },
  };
}

export const useChatStore = () => useStore(ChatStore);

export const ChatStoreProvider = createStoreProvider(ChatStore);
