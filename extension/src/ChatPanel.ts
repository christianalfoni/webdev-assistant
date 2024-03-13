import * as vscode from "vscode";
import { Assistant } from "./Assistant";
import { Embedder } from "./Embedder";
import { getAssistantId, getOpenAiApiKey } from "./config";

import {
  ChatPanelClientMessage,
  ChatPanelClientState,
  ChatPanelMessage,
  ChatPanelState,
} from "./types";
import OpenAI from "openai";
import { ToolCallEvent } from "./AssistantTools";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("webDevAssistant.open", () => {
      ChatPanel.createOrShow(context.extensionUri);
    })
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    vscode.window.registerWebviewPanelSerializer(ChatPanel.viewType, {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        state: any
      ) {
        console.log(`Got state: ${state}`);
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
        ChatPanel.revive(webviewPanel, context.extensionUri);
      },
    });
  }
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    // Enable javascript in the webview
    enableScripts: true,

    // And restrict the webview to only loading content from our extension's `media` directory.
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
  };
}

/**
 * Manages cat coding webview panels
 */
class ChatPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: ChatPanel | undefined;
  public static readonly viewType = "webDevAssistant";
  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
  }
  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      "WebDev Assistant",
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri)
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
  }

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _state: ChatPanelState = {
    status: "NO_WORKSPACE",
  };
  private clientState: ChatPanelClientState = {
    status: "NO_WORKSPACE",
  };

  get state() {
    return this._state;
  }

  get assistant() {
    if (this._state.status !== "READY") {
      throw new Error("The panel is not in a READY state");
    }

    return this._state.assistant;
  }

  set state(state: ChatPanelState) {
    console.log("STATE", state);
    this._state = state;

    switch (state.status) {
      case "ERROR": {
        this.clientState = {
          status: "ERROR",
          error: state.error,
        };
        break;
      }
      case "LOADING_EMBEDDINGS": {
        this.clientState = {
          status: "LOADING_EMBEDDINGS",
        };
        break;
      }
      case "MISSING_CONFIG": {
        this.clientState = {
          status: "MISSING_CONFIG",
        };
        break;
      }
      case "NO_WORKSPACE": {
        this.clientState = {
          status: "NO_WORKSPACE",
        };
        break;
      }
      case "READY": {
        this.clientState = {
          status: "READY",
          messages: [],
        };
        break;
      }
    }

    this.sendMessageToClient({
      type: "state_update",
      state: this.clientState,
    });
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    // this._panel.webview.postMessage({ command: 'refactor' });
    this._panel = panel;
    this._extensionUri = extensionUri;

    this.state = this.updateWorkspace();
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.state = this.updateWorkspace();
    });

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: ChatPanelClientMessage) => {
        this.handleClientMessage(message);
      },
      null,
      this._disposables
    );
  }

  private handleClientMessage(message: ChatPanelClientMessage) {
    switch (message.type) {
      case "assistant_request": {
        this.updateClientReadyState((current) => ({
          ...current,
          messages: [
            ...current.messages,
            {
              role: "user",
              text: message.text,
            },
            {
              role: "assistant",
              text: "",
              actions: [],
            },
          ],
        }));
        this.assistant.addMessage(message.text);
        break;
      }
      case "state_request": {
        this.sendMessageToClient({
          type: "state_update",
          state: this.clientState,
        });
        break;
      }
    }
  }

  private handleAssistantMessage(message: string) {
    this.updateClientReadyState((current) => {
      const lastAssistantMessage = current.messages
        .filter((message) => message.role === "assistant")
        .pop();

      // This should never happen
      if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
        return current;
      }

      return {
        ...current,
        messages: [
          ...current.messages.slice(0, current.messages.length - 1),
          {
            ...lastAssistantMessage,
            text: message,
          },
        ],
      };
    });
  }

  private handleAssistantRunUpdate(run: OpenAI.Beta.Threads.RunStatus) {
    // Can be used to show the state of the conversation
  }

  private handleAssistantToolCallEvent(toolCallEvent: ToolCallEvent) {
    this.updateClientReadyState((current) => {
      const lastAssistantMessage = current.messages
        .filter((message) => message.role === "assistant")
        .pop();

      // This should never happen
      if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
        return current;
      }

      const actionIndex = lastAssistantMessage.actions.findIndex(
        (action) => action.id === toolCallEvent.id
      );

      return {
        ...current,
        messages: [
          ...current.messages.slice(0, current.messages.length - 1),
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
        ],
      };
    });
  }

  private sendMessageToClient(message: ChatPanelMessage) {
    this._panel.webview.postMessage(message);
  }

  private updateClientReadyState(
    cb: (
      current: ChatPanelClientState & { status: "READY" }
    ) => ChatPanelClientState & { status: "READY" }
  ) {
    if (this.clientState.status !== "READY") {
      return;
    }

    this.clientState = cb(this.clientState);
    this.sendMessageToClient({
      type: "state_update",
      state: this.clientState,
    });
  }

  private updateWorkspace(): ChatPanelState {
    const workspacePath = getWorkspacePath();

    // If already loaded, but changing to new workspace, we dispose
    // of the assistant
    if (
      this.state &&
      this.state.status === "READY" &&
      this.state.path !== workspacePath
    ) {
      this.state.assistant.dispose();
    }

    // We might change during the loading of the embedder, in this case
    // we wait until it resolves and then dispose of it
    if (
      this.state &&
      this.state.status === "LOADING_EMBEDDINGS" &&
      this.state.path !== workspacePath
    ) {
      this.state.embedder.then((embedder) => embedder.dispose());
    }

    if (!workspacePath) {
      return {
        status: "NO_WORKSPACE",
      };
    }

    const openAiApiKey = getOpenAiApiKey();
    const assistantId = getAssistantId();

    if (!openAiApiKey || !assistantId) {
      return {
        status: "MISSING_CONFIG",
        path: workspacePath,
      };
    }

    // If we somehow load the same workspace, we do nothing
    if (
      this.state &&
      (this.state.status === "READY" ||
        this.state.status === "LOADING_EMBEDDINGS") &&
      this.state.path === workspacePath
    ) {
      return this.state;
    }

    const openai = new OpenAI({
      apiKey: openAiApiKey,
    });

    const embedder = Embedder.load(workspacePath, openai);

    const pendingState: ChatPanelState = {
      status: "LOADING_EMBEDDINGS",
      path: workspacePath,
      embedder,
    };

    embedder
      .then((embedder) => {
        if (this.state === pendingState) {
          const assistant = new Assistant({
            workspacePath,
            openai,
            assistantId,
            embedder,
          });

          this.state = {
            status: "READY",
            path: workspacePath,
            assistant,
          };

          assistant.onMessage((message) =>
            this.handleAssistantMessage(message)
          );
          assistant.onRunStatusUpdate((run) =>
            this.handleAssistantRunUpdate(run)
          );
          assistant.onToolCallEvent((toolCallEvent) =>
            this.handleAssistantToolCallEvent(toolCallEvent)
          );
        }
      })
      .catch((error) => {
        if (this.state === pendingState) {
          this.state = {
            status: "ERROR",
            error: String(error),
          };
        }
      });

    return pendingState;
  }

  private _update() {
    const webview = this._panel.webview;

    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "main.js"
    );

    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    // Local path to css styles
    const styleResetPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "reset.css"
    );
    const stylesVscodePath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "vscode.css"
    );
    const stylesMainPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "styles.css"
    );

    const stylesXtermPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "xterm.css"
    );

    // Uri to load styles into webview
    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesVscodeUri = webview.asWebviewUri(stylesVscodePath);
    const stylesMainUri = webview.asWebviewUri(stylesMainPath);
    const stylesXtermUri = webview.asWebviewUri(stylesXtermPath);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesVscodeUri}" rel="stylesheet">
        <link href="${stylesMainUri}" rel="stylesheet">
        <link href="${stylesXtermUri}" rel="stylesheet">

				<title>WebDev Assistant</title>
			</head>
			<body>
				<div id="root"></div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getWorkspacePath() {
  return vscode.workspace.workspaceFolders?.[0].uri.path;
}
