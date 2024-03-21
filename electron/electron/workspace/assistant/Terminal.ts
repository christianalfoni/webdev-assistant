import * as cp from "child_process";

export class Terminal {
  private child: cp.ChildProcessWithoutNullStreams;
  private onDetach: () => void;
  private _hasError = false;

  private _isDetached = false;

  get isDetached() {
    return this._isDetached;
  }

  get hasError() {
    return this._hasError;
  }

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

    console.log("Running command", command, args);

    const child = cp.spawn(command, args, {
      cwd: workspacePath,
      detached: true,
    });

    this.child = child;

    child.stdout.addListener("data", (data) => {
      const stringData = data.toString();

      this._hasError = false;

      this.buffer.push(stringData);

      onOutput(stringData);
    });

    child.stderr.addListener("data", (data) => {
      const stringData = data.toString();

      this._hasError = true;

      this.buffer.push(stringData);

      console.log("Adding error", stringData);

      onOutput(stringData);
    });

    child.addListener("close", () => console.log("CLOSED TERMINAL"));
    child.addListener("disconnect", () => console.log("DISCONNECT TERMINAL"));
    child.addListener("error", (error) => {
      const stringData = String(error);

      this._hasError = true;

      this.buffer.push(stringData);

      onOutput(stringData);
    });
    child.addListener("message", () => console.log("MESSAGE TERMINAL"));

    child.addListener("exit", onClose);
  }

  sendInput(input: string) {
    this.child.stdin.write(input);
  }
  detach() {
    if (this._isDetached) {
      return;
    }

    this._isDetached = true;
    this.onDetach();
  }
  dispose() {
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();

    if (!this.child.pid) {
      // It failed to even start
      return;
    }

    if (process.platform == "win32") {
      cp.exec(
        `taskkill /PID ${this.child.pid} /T /F`,
        (error, stdout, stderr) => {
          console.log("taskkill stdout: " + stdout);
          console.log("taskkill stderr: " + stderr);
          if (error) {
            console.log("error: " + error.message);
          }
        }
      );
    } else {
      // see https://nodejs.org/api/child_process.html#child_process_options_detached
      // If pid is less than -1, then sig is sent to every process in the process group whose ID is -pid.
      process.kill(-this.child.pid, "SIGTERM");
    }
  }
}
