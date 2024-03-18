import { createRoot } from "react-dom/client";
import { Button } from "./ui-components/button";
import { useEditorStore } from "./editorStore";

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
            editorStore.openWorkspace();
          }}
        >
          Open Workspace
        </Button>
      </div>
    );
  }

  return <h1>GOTZ WORKSPACE! {editorState.path}</h1>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
