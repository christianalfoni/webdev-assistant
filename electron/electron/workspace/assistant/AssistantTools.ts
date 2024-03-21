import OpenAI from "openai";
import * as fs from "fs/promises";
import * as cp from "child_process";

import { Embedder } from "../Embedder";
import {
  Emitter,
  defaultIgnores,
  getGitIgnoreGlobs,
  normalizePath,
} from "../utils";

// @ts-ignore
import parseGitignore from "gitignore-globs";
import { glob } from "glob";
import { Terminal } from "./Terminal";
import { ToolCallEvent, ToolCallEventType } from "./types";

type RuntimeError = { message: string; stack: string };

type RuntimeMessage =
  | {
      type: "loaded";
    }
  | {
      type: "errors";
      errors: RuntimeError[];
    };

export class AssistantTools {
  private onToolCallEventEmitter = new Emitter<ToolCallEvent>();
  onToolCallEvent = this.onToolCallEventEmitter.event;

  private onTerminalOutputEmitter = new Emitter<{
    id: string;
    data: string;
  }>();
  onTerminalOutput = this.onTerminalOutputEmitter.event;

  private terminals: Record<string, Terminal> = {};

  private runtimeErrors: RuntimeError[] = [];

  constructor(private workspacePath: string, private embedder: Embedder) {}

  handleTerminalInput(actionId: string, input: string) {
    if (!this.terminals[actionId]) {
      return;
    }

    this.terminals[actionId].sendInput(input);
  }
  handleKillTerminal(actionId: string) {
    if (!this.terminals[actionId]) {
      return;
    }

    console.log("Killing terminal");

    // Closes it, which will remove it
    this.terminals[actionId].dispose();
  }
  handleKeepTerminal(actionId: string) {
    if (!this.terminals[actionId]) {
      return;
    }

    this.terminals[actionId].detach();
  }
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
            output = await this.runTerminalCommand(id, args.command, args.args);
          } else if (isToolCall("search_file_paths")) {
            output = await this.searchFilePaths(id, args.path);
          } else if (isToolCall("read_development_logs")) {
            output = await this.readDevelopmentLogs(id);
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
  private async runTerminalCommand(
    id: string,
    command: string,
    args: string[]
  ) {
    return new Promise<{ exitCode: number; output: string }>((resolve) => {
      const fullCommand = command + " " + args.join(" ");

      const terminal = new Terminal({
        id,
        command,
        args,
        workspacePath: this.workspacePath,
        onClose: (exitCode) => {
          delete this.terminals[id];

          if (exitCode === 1 || terminal.hasError) {
            this.onToolCallEventEmitter.fire({
              id,
              status: "rejected",
              buffer: terminal.buffer,
              error: "Exited with code " + exitCode,
              type: "run_terminal_command",
              command: fullCommand,
            });
          } else {
            this.onToolCallEventEmitter.fire({
              id,
              status: "resolved",
              buffer: terminal.buffer,
              type: "run_terminal_command",
              command: fullCommand,
            });
          }

          resolve({ exitCode: exitCode || 0, output: terminal.buffer.join() });
        },
        onDetach: () => {
          this.onToolCallEventEmitter.fire({
            id,
            status: "resolved",
            buffer: terminal.buffer,
            type: "run_terminal_command",
            command: fullCommand,
          });
          resolve({ exitCode: 1, output: terminal.buffer.join() });
        },
        onOutput: (data) => {
          this.onTerminalOutputEmitter.fire({
            id,
            data,
          });
        },
      });

      this.terminals[id] = terminal;

      this.onToolCallEventEmitter.fire({
        id,
        buffer: terminal.buffer,
        status: "pending",
        type: "run_terminal_command",
        command: fullCommand,
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
        cwd: this.workspacePath,
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
  private readDevelopmentLogs(id: string): Array<
    | {
        type: "process";
        command: string;
        output: string;
      }
    | {
        type: "runtime";
        message: string;
        stack: string;
      }
  > {
    this.onToolCallEventEmitter.fire({
      id,
      status: "pending",
      type: "read_development_logs",
    });

    try {
      const processLogs = Object.values(this.terminals).map((terminal) => ({
        type: "process" as const,
        command: terminal.command,
        output: terminal.buffer.join(),
      }));

      this.onToolCallEventEmitter.fire({
        id,
        status: "resolved",
        type: "read_development_logs",
      });

      const runtimeErrors = this.runtimeErrors.map(({ message, stack }) => ({
        type: "runtime" as const,
        message,
        stack,
      }));

      this.runtimeErrors = [];

      console.log("WTF", runtimeErrors);

      return [...processLogs, ...runtimeErrors];
    } catch (error) {
      this.onToolCallEventEmitter.fire({
        id,
        error: String(error),
        status: "rejected",
        type: "read_development_logs",
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
