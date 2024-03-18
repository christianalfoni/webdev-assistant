import { createRoot } from "react-dom/client";
import { Button } from "./ui-components/button";
import { useEditorStore } from "./editorStore";
import { WorkspaceStoreProvider } from "./workspace/workspaceStore";
import { Workspace } from "./workspace/Workspace";

function App() {
  const editorStore = useEditorStore();

  if (editorStore.state.status === "pending") {
    return null;
  }

  if (editorStore.state.status === "rejected") {
    return String(editorStore.state.reason);
  }

  const editorState = editorStore.state.value;

  if (editorState.status === "ERROR") {
    return editorState.error;
  }

  if (editorState.status === "NO_WORKSPACE") {
    return (
      <div className="bg-white dark:bg-zinc-900 h-screen w-screen flex items-center justify-center">
        <Button
          onClick={() => {
            editorStore.api.openWorkspace();
          }}
        >
          Open Workspace
        </Button>
      </div>
    );
  }

  return (
    <WorkspaceStoreProvider key={editorState.path}>
      <Workspace />
    </WorkspaceStoreProvider>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
