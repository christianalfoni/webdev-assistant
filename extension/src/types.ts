import { ToolCallEvent } from "./AssistantTools";
import { Embedder, EmbedderState } from "./Embedder";
import { Assistant } from "./Assistant";

export type ChatPanelState =
  | {
      status: "NO_WORKSPACE";
    }
  | {
      status: "MISSING_CONFIG";
      path: string;
    }
  | {
      status: "READY";
      path: string;
      assistant: Assistant;
      embedder: Embedder;
    }
  | {
      status: "ERROR";
      error: string;
    };

export type AssistantAction = ToolCallEvent;

export type ChatMessage =
  | {
      role: "assistant";
      text: string;
      actions: AssistantAction[];
    }
  | {
      role: "user";
      text: string;
    };

export type ChatPanelClientMessage =
  | {
      type: "assistant_request";
      text: string;
    }
  | {
      type: "state_request";
    }
  | {
      type: "terminal_input";
      actionId: string;
      input: string;
    }
  | {
      type: "terminal_kill";
      actionId: string;
    };

export type ChatPanelMessage =
  | {
      type: "state_update";
      state: ChatPanelClientState;
    }
  | {
      type: "terminal_output";
      id: string;
      data: string;
    };

export type ChatPanelClientState =
  | {
      status: "NO_WORKSPACE";
    }
  | {
      status: "MISSING_CONFIG";
    }
  | {
      status: "READY";
      messages: ChatMessage[];
      embedderState: EmbedderState;
    }
  | {
      status: "ERROR";
      error: string;
    };
