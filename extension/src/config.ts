import * as vscode from "vscode";

const config = vscode.workspace.getConfiguration("webDevAssistant");

export function getOpenAiApiKey(): string {
  return config.get("openAiApiKey") || "";
}

export function getAssistantId(): string {
  return config.get("assistantId") || "";
}
