import OpenAI from "openai";
import { Embedder } from "./Embedder";
import { Assistant } from "./assistant/Assistant";
import { getAssistantId, getOpenAiApiKey } from "./config";
import { ElectronApi } from "../ElectronApi";
import { ChatMessage } from "./types";
import { ToolCallEvent } from "./assistant/types";

export class Workspace {
  private assistant: Assistant;
  private embedder: Embedder;

  private _messages: ChatMessage[] = [
    {
      role: "assistant",
      text: "",
      actions: [],
    },
  ];
  get messages() {
    return this._messages;
  }
  set messages(updatedMessages) {
    this._messages = updatedMessages;
    this.electronApi.sendMessages(updatedMessages);
  }

  constructor(private path: string, private electronApi: ElectronApi) {
    const openai = new OpenAI({
      apiKey: getOpenAiApiKey(),
    });

    this.embedder = new Embedder(path, openai);
    this.assistant = new Assistant({
      assistantId: getAssistantId(),
      embedder: this.embedder,
      openai,
      workspacePath: path,
    });

    electronApi.onSendAssistantMessage((message) =>
      this.handleSendAssistantMessage(message)
    );
    electronApi.onInputTerminal((actionId, input) =>
      this.assistant.handleTerminalInput(actionId, input)
    );
    electronApi.onKeepTerminal((actionId) =>
      this.assistant.handleKeepTerminal(actionId)
    );
    electronApi.onKillTerminal((actionId) =>
      this.assistant.handleKillTerminal(actionId)
    );

    electronApi.handleGetMessages(() => this.messages);
    electronApi.handleGetEmbedderState(() => this.embedder.state);

    this.assistant.onTerminalOutput(({ id, data }) => {
      electronApi.sendTerminalOutput(id, data);
    });
    this.assistant.onMessageDelta((message) =>
      this.handleAssistantMessage(message)
    );
    this.assistant.onToolCallEvent((toolCallEvent) =>
      this.handleAssistantToolCallEvent(toolCallEvent)
    );
    this.embedder.onStateChange((embedderState) =>
      electronApi.sendEmbedderState(embedderState)
    );

    this.assistant.addMessage(
      "Please help me start development of this project"
    );

    this.assistant.onPortOpened((port) => {
      console.log("Opened port", port);
    });
  }
  private handleAssistantMessage(message: string) {
    if (!this.messages.length) {
      this.messages = [{ actions: [], role: "assistant", text: message }];
      return;
    }

    const lastAssistantMessage = this.messages
      .filter((message) => message.role === "assistant")
      .pop();

    // This should never happen
    if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
      return;
    }

    this.messages = [
      ...this.messages.slice(0, this.messages.length - 1),
      {
        ...lastAssistantMessage,
        text: lastAssistantMessage.text + message,
      },
    ];
  }
  private handleAssistantToolCallEvent(toolCallEvent: ToolCallEvent) {
    if (!this.messages.length) {
      this.messages = [
        { actions: [toolCallEvent], role: "assistant", text: "" },
      ];
      return;
    }

    const lastAssistantMessage = this.messages
      .filter((message) => message.role === "assistant")
      .pop();

    // This should never happen
    if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
      return;
    }

    const actionIndex = lastAssistantMessage.actions.findIndex(
      (action) => action.id === toolCallEvent.id
    );

    this.messages = [
      ...this.messages.slice(0, this.messages.length - 1),
      {
        ...lastAssistantMessage,
        actions:
          actionIndex === -1
            ? [...lastAssistantMessage.actions, toolCallEvent]
            : [
                ...lastAssistantMessage.actions.slice(0, actionIndex),
                toolCallEvent,
                ...lastAssistantMessage.actions.slice(actionIndex + 1),
              ],
      },
    ];
  }
  private handleSendAssistantMessage(message: string) {
    this.messages = [
      ...this.messages,
      {
        role: "user",
        text: message,
      },
      {
        role: "assistant",
        text: "",
        actions: [],
      },
    ];

    this.assistant.addMessage(message);
  }
  dispose() {
    this.assistant.dispose();
    this.embedder.dispose();
  }
}
