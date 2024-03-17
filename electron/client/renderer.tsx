import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { electronAPI } from "./electronApi";
import { Button } from "./ui-components/button";
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

function App() {
  return (
    <div className="bg-white dark:bg-zinc-900 h-screen w-screen flex items-center justify-center">
      <Button
        onClick={() => {
          electronAPI.openWorkspace();
        }}
      >
        Open Workspace
      </Button>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
