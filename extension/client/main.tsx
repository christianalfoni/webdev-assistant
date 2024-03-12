import { createRoot } from "react-dom/client";
import { ChatPanel } from "./ChatPanel";

const root = createRoot(document.getElementById("root")!);

root.render(<ChatPanel />);
