import * as cp from "child_process";

export class Terminal {
  private child: cp.ChildProcessWithoutNullStreams;
  private onDetach: () => void;

  id: string;
  buffer: string[] = [];
  command: string;

  constructor({
    id,
    workspacePath,
    command,
    args,
    onOutput,
    onClose,
    onDetach,
  }: {
    id: string;
    workspacePath: string;
    command: string;
    args: string[];
    onOutput: (output: string) => void;
    onClose: (exitCode: number | null) => void;
    onDetach: () => void;
  }) {
    this.id = id;
    this.command = command;
    this.onDetach = onDetach;

    const child = cp.spawn(command, args, {
      cwd: workspacePath,
    });

    this.child = child;

    child.stdout.addListener("data", (data) => {
      const stringData = data.toString();

      this.buffer.push(stringData);

      onOutput(stringData);
    });

    child.stderr.addListener("data", (data) => {
      const stringData = data.toString();

      this.buffer.push(stringData);

      onOutput(stringData);
    });

    child.addListener("close", () => console.log("CLOSED TERMINAL"));
    child.addListener("disconnect", () => console.log("DISCONNECT TERMINAL"));
    child.addListener("error", () => console.log("ERROR TERMINAL"));
    child.addListener("message", () => console.log("MESSAGE TERMINAL"));

    child.addListener("exit", onClose);
  }
  sendInput(input: string) {
    this.child.stdin.write(input);
  }
  detach() {
    this.onDetach();
  }
  dispose() {
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    this.child.kill("SIGKILL");
  }
}
