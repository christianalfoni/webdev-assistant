import { ToolCallEvent } from "./assistant/types";

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

export type EmbedderState = "CREATING" | "UPDATING" | "READY";
