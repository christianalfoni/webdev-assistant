import OpenAI from "openai";
import { EventEmitter } from "vscode";
import * as fs from "fs/promises";
import * as cp from "child_process";

import { Embedder } from "./Embedder";
import { defaultIgnores, getGitIgnoreGlobs, normalizePath } from "./utils";

// @ts-ignore
import parseGitignore from "gitignore-globs";
import { glob } from "glob";

export type ToolCallEventType = ToolCallEvent["type"];

export type ToolCallEvent = { id: string } & (
  | {
      status: "pending" | "resolved";
    }
  | {
      status: "rejected";
      error: string;
    }
) &
  (
    | {
        type: "search_code_embeddings";
        query: string;
      }
    | {
        type: "search_doc_embeddings";
        query: string;
      }
    | {
        type: "read_file";
        path: string;
      }
    | {
        type: "write_file";
        path: string;
        content: string;
      }
    | {
        type: "read_directory";
        path: string;
      }
    | {
        type: "delete_file_or_directory";
        path: string;
      }
    | {
        type: "run_terminal_command";
        command: string;
        buffer: string[];
      }
    | {
        type: "search_file_paths";
        path: string;
      }
  );

export class AssistantTools {
  private onToolCallEventEmitter = new EventEmitter<ToolCallEvent>();
  onToolCallEvent = this.onToolCallEventEmitter.event;

  private onTerminalOutputEmitter = new EventEmitter<{
    id: string;
    data: string;
  }>();
  onTerminalOutput = this.onTerminalOutputEmitter.event;

  private terminals: Record<string, cp.ChildProcessWithoutNullStreams> = {};

  constructor(private workspacePath: string, private embedder: Embedder) {}

  handleTerminalInput(actionId: string, input: string) {
    if (!this.terminals[actionId]) {
      return;
    }

    this.terminals[actionId].stdin.write(input);
  }
  handleKillTerminal(actionId: string) {
    if (!this.terminals[actionId]) {
      return;
    }

    console.log("Killing terminal");

    this.terminals[actionId].stdin.destroy();
    this.terminals[actionId].stdout.destroy();
    this.terminals[actionId].stderr.destroy();
    this.terminals[actionId].kill("SIGKILL");
  }
  handleKeepTerminal(actionId: string) {}
  handleToolCalls(
    toolCalls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[]
  ) {
    return Promise.all(
      toolCalls.map(async (toolCall) => {
        if (toolCall.type !== "function") {
          return Promise.reject(
            "Tool call type " + toolCall.type + " is not supported"
          );
        }

        const args = JSON.parse(toolCall.function.arguments);

        let output;

        const id = toolCall.id;
        const isToolCall = <T extends ToolCallEventType>(type: T) => {
          return toolCall.function.name === type;
        };

        try {
          if (isToolCall("search_code_embeddings")) {
            output = await this.searchCodeEmbeddings(id, args.query);
          } else if (isToolCall("search_doc_embeddings")) {
            output = await this.searchDocEmbeddings(id, args.query);
          } else if (isToolCall("read_file")) {
            output = await this.readFile(id, args.path);
          } else if (isToolCall("write_file")) {
            output = await this.writeFile(id, args.path, args.content);
          } else if (isToolCall("read_directory")) {
            output = await this.readDirectory(id, args.path);
          } else if (isToolCall("delete_file_or_directory")) {
            output = await this.deleteFileOrDirectory(id, args.path);
          } else if (isToolCall("run_terminal_command")) {
            output = await this.runTerminalCommand(id, args.command);
          } else if (isToolCall("search_file_paths")) {
            output = await this.searchFilePaths(id, args.path);
          } else {
            throw new Error("Not implemented " + toolCall.function.name);
          }
        } catch (error) {
          output = String(error);
        }

        return {
          tool_call_id: toolCall.id,
          output: typeof output === "string" ? output : JSON.stringify(output),
        };
      })
    );
  }
  private searchCodeEmbeddings(id: string, query: string) {
    this.onToolCallEventEmitter.fire({
      id,
      status: "pending",
      type: "search_code_embeddings",
      query,
    });

    try {
      const result = this.embedder.searchCodeEmbeddings(query);

      this.onToolCallEventEmitter.fire({
        id,
        status: "resolved",
        type: "search_code_embeddings",
        query,
      });

      return result;
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        status: "rejected",
        error: String(error),
        type: "search_code_embeddings",
        query,
      });

      throw error;
    }
  }
  private searchDocEmbeddings(id: string, query: string) {
    this.onToolCallEventEmitter.fire({
      id,
      status: "pending",

      type: "search_doc_embeddings",
      query,
    });

    try {
      const result = this.embedder.searchDocEmbeddings(query);
      this.onToolCallEventEmitter.fire({
        id,
        status: "resolved",

        type: "search_doc_embeddings",
        query,
      });
      return result;
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        status: "rejected",
        error: String(error),
        type: "search_doc_embeddings",
        query,
      });

      throw error;
    }
  }
  private async readFile(id: string, path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);
    const relativePath = normalizedPath.substring(
      this.workspacePath.length + 1
    );

    this.onToolCallEventEmitter.fire({
      id,

      status: "pending",
      type: "read_file",
      path: relativePath,
    });

    try {
      const content = await fs.readFile(normalizedPath);

      this.onToolCallEventEmitter.fire({
        id,

        status: "resolved",
        type: "read_file",
        path: relativePath,
      });

      return content.toString();
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "read_file",
        path: relativePath,
      });

      throw error;
    }
  }
  private async writeFile(id: string, path: string, content: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);
    const relativePath = normalizedPath.substring(
      this.workspacePath.length + 1
    );

    this.onToolCallEventEmitter.fire({
      id,

      status: "pending",
      type: "write_file",
      path: relativePath,
      content,
    });

    try {
      await fs.writeFile(normalizedPath, content);

      this.onToolCallEventEmitter.fire({
        id,

        status: "resolved",
        type: "write_file",
        path: relativePath,
        content,
      });

      return "success";
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "write_file",
        path: relativePath,
        content,
      });
      throw error;
    }
  }
  private readDirectory(id: string, path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);
    const relativePath = normalizedPath.substring(
      this.workspacePath.length + 1
    );

    this.onToolCallEventEmitter.fire({
      id,

      status: "pending",
      type: "read_directory",
      path: relativePath,
    });

    try {
      const result = fs.readdir(normalizedPath);

      this.onToolCallEventEmitter.fire({
        id,

        status: "resolved",
        type: "read_directory",
        path: relativePath,
      });

      return result;
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "read_directory",
        path: relativePath,
      });

      throw error;
    }
  }
  private async deleteFileOrDirectory(id: string, path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);
    const relativePath = normalizedPath.substring(
      this.workspacePath.length + 1
    );

    this.onToolCallEventEmitter.fire({
      id,

      status: "pending",
      type: "delete_file_or_directory",
      path: relativePath,
    });

    try {
      await fs.rm(normalizedPath, {
        force: true,
        recursive: true,
      });

      this.onToolCallEventEmitter.fire({
        id,

        status: "resolved",
        type: "delete_file_or_directory",
        path: relativePath,
      });

      return "success";
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "delete_file_or_directory",
        path: relativePath,
      });

      throw error;
    }
  }
  private async runTerminalCommand(id: string, command: string) {
    const buffer: string[] = [];

    this.onToolCallEventEmitter.fire({
      id,
      buffer,
      status: "pending",
      type: "run_terminal_command",
      command,
    });

    return new Promise<{ exitCode: number; output: string }>((resolve) => {
      const [cmd, ...args] = command.split(" ");

      const child = cp.spawn(cmd, args, {
        cwd: this.workspacePath,
      });

      this.terminals[id] = child;

      child.stdout.addListener("data", (data) => {
        const stringData = data.toString();

        buffer.push(stringData);

        this.onTerminalOutputEmitter.fire({
          id,
          data: stringData,
        });
      });

      child.stderr.addListener("data", (data) => {
        const stringData = data.toString();

        buffer.push(stringData);

        this.onTerminalOutputEmitter.fire({
          id,
          data: stringData,
        });
      });

      child.addListener("close", () => console.log("CLOSED TERMINAL"));
      child.addListener("disconnect", () => console.log("DISCONNECT TERMINAL"));
      child.addListener("error", () => console.log("ERROR TERMINAL"));
      child.addListener("message", () => console.log("MESSAGE TERMINAL"));

      child.addListener("exit", (exitCode) => {
        delete this.terminals[id];

        console.log("EXIT CODE", exitCode);

        if (exitCode === 1) {
          this.onToolCallEventEmitter.fire({
            id,
            status: "rejected",
            buffer,
            error: "Exited with code 1",
            type: "run_terminal_command",
            command,
          });

          resolve({ exitCode: 1, output: buffer.join() });
        } else {
          this.onToolCallEventEmitter.fire({
            id,
            status: "resolved",
            buffer,
            type: "run_terminal_command",
            command,
          });

          resolve({ exitCode: 0, output: buffer.join() });
        }
      });
    });
  }

  private async searchFilePaths(id: string, path: string) {
    this.onToolCallEventEmitter.fire({
      id,

      status: "pending",
      type: "search_file_paths",
      path,
    });

    try {
      const gitignoreGlobs = getGitIgnoreGlobs(this.workspacePath);
      const files = await glob("**/*.*", {
        ignore: defaultIgnores.concat(gitignoreGlobs),
      });

      const result = files.filter((filepath) => filepath.includes(path));

      this.onToolCallEventEmitter.fire({
        id,

        status: "resolved",
        type: "search_file_paths",
        path,
      });

      return result;
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "search_file_paths",
        path,
      });

      throw error;
    }
  }
  dispose() {
    this.onToolCallEventEmitter.dispose();
    Object.keys(this.terminals).forEach((actionId) => {
      this.handleKillTerminal(actionId);
    });
  }
}
