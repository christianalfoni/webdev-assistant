import * as vscode from "vscode";
import { activate as activateChatPanel } from "./ChatPanel";

export function activate(context: vscode.ExtensionContext) {
  console.log("WUUUUT THE FUDGE?");
  activateChatPanel(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
