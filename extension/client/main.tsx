import { createRoot } from "react-dom/client";

function HelloWorld() {
  return <h1>Hello world!</h1>;
}

const root = createRoot(document.getElementById("root")!);

root.render(<HelloWorld />);
