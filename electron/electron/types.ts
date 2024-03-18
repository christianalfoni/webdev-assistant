import { Workspace } from "./workspace/Workspace";

export type EditorState =
  | {
      status: "NO_WORKSPACE";
    }
  | {
      status: "WORKSPACE";
      path: string;
      workspace: Workspace;
    }
  | {
      status: "ERROR";
      error: string;
    };

export type EditorClientState =
  | {
      status: "NO_WORKSPACE";
    }
  | {
      status: "WORKSPACE";
      path: string;
    }
  | {
      status: "ERROR";
      error: string;
    };
