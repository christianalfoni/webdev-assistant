import { ToolCallEvent } from "./AssistantTools";
import { Embedder } from "./Embedder";
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
      status: "LOADING_EMBEDDINGS";
      path: string;
      embedder: Promise<Embedder>;
    }
  | {
      status: "READY";
      path: string;
      assistant: Assistant;
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

export type ChatPanelMessage = {
  type: "state_update";
  state: ChatPanelClientState;
};

export type ChatPanelClientState =
  | {
      status: "NO_WORKSPACE";
    }
  | {
      status: "MISSING_CONFIG";
    }
  | {
      status: "LOADING_EMBEDDINGS";
    }
  | {
      status: "READY";
      messages: ChatMessage[];
    }
  | {
      status: "ERROR";
      error: string;
    };
