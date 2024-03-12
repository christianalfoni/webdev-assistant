import { ToolCallEvent } from "./AssistantTools";
import { Embedder } from "./Embedder";
import { WorkspaceAssistant } from "./WorkspaceAssistant";

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
      assistant: WorkspaceAssistant;
    }
  | {
      status: "ERROR";
      error: string;
    };

export type AssistantAction = ToolCallEvent &
  (
    | {
        status: "pending";
      }
    | {
        status: "resolved";
        result: string;
      }
    | {
        status: "rejected";
        error: string;
      }
  );

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
      message: string;
    }
  | {
      type: "state_request";
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
