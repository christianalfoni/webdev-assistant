import * as vscode from "vscode";
import { activate as activateChatPanel } from "./ChatPanel";

export function activate(context: vscode.ExtensionContext) {
  activateChatPanel(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
