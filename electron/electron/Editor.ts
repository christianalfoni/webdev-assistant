import { BrowserWindow, dialog } from "electron";
import { ElectronApi } from "./ElectronApi";
import { EditorClientState, EditorState } from "./types";
import { Disposable } from "./workspace/utils";
import { Workspace } from "./workspace/Workspace";

export class Editor {
  static create(electronApi: ElectronApi, mainWindow: BrowserWindow) {
    return new Editor(electronApi, mainWindow);
  }

  private disposer = new Disposable();

  private _state: EditorState = {
    status: "NO_WORKSPACE",
  };

  private clientState: EditorClientState = {
    status: "NO_WORKSPACE",
  };

  constructor(
    private electronApi: ElectronApi,
    private mainWindow: BrowserWindow
  ) {
    this.handleOnOpenWorkspace();
    this.handleGetWorkspaceState();
  }

  get state() {
    return this._state;
  }

  set state(newState) {
    this._state = newState;

    switch (newState.status) {
      case "ERROR": {
        this.clientState = {
          status: "ERROR",
          error: newState.error,
        };
        break;
      }
      case "NO_WORKSPACE": {
        this.clientState = {
          status: "NO_WORKSPACE",
        };
        break;
      }
      case "WORKSPACE": {
        this.clientState = {
          status: "WORKSPACE",
          path: newState.path,
        };
        break;
      }
    }

    this.electronApi.sendEditorState(this.clientState);
  }

  private handleOnOpenWorkspace() {
    this.disposer.addDisposable(
      this.electronApi.onOpenWorkspace(async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(
          this.mainWindow,
          {
            title: "Open workspace folder",
            properties: ["openDirectory"],
          }
        );

        const workspacePath = filePaths[0];
        this.state = {
          status: "WORKSPACE",
          path: workspacePath,
          workspace: new Workspace(workspacePath, this.electronApi),
        };
      })
    );
  }

  private handleGetWorkspaceState() {
    this.disposer.addDisposable(
      this.electronApi.handleGetEditorState(() => this.clientState)
    );
  }

  dispose() {
    this.disposer.dispose();

    if (this.state.status === "WORKSPACE") {
      this.state.workspace.dispose();
    }
  }
}
