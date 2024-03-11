import * as path from "path";
import OpenAI from "openai";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMessageOutput(
  message: OpenAI.Beta.Threads.ThreadMessage
) {
  return `${message.role}: ${message.content
    .map((content) =>
      content.type === "text" ? content.text.value : "Image Not Available"
    )
    .join("\n")}`;
}

export function normalizePath(workspacePath: string, filepath: string) {
  return path.resolve(workspacePath, filepath);
}
