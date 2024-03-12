import OpenAI from "openai";
import { EventEmitter } from "vscode";
import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as util from "util";
import * as cp from "child_process";
import { Embedder } from "./Embedder";
import { defaultIgnores, getGitIgnoreGlobs, normalizePath } from "./utils";
// @ts-ignore
import parseGitignore from "gitignore-globs";
import { glob } from "glob";

const exec = util.promisify(cp.exec);

export type ToolCallEventType = ToolCallEvent["type"];

export type ToolCallEvent =
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
      type: "delete_file";
      path: string;
    }
  | {
      type: "run_terminal_command";
      command: string;
    }
  | {
      type: "search_file_paths";
      path: string;
    };

export class AssistantTools {
  private onToolCallEventEmitter = new EventEmitter<ToolCallEvent>();
  onToolCallEvent = this.onToolCallEventEmitter.event;

  constructor(private workspacePath: string, private embedder: Embedder) {}

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

        const isToolCall = <T extends ToolCallEventType>(type: T) => {
          return toolCall.function.name === type;
        };

        try {
          if (isToolCall("search_code_embeddings")) {
            output = await this.searchCodeEmbeddings(args.query);
          } else if (isToolCall("search_doc_embeddings")) {
            output = await this.searchDocEmbeddings(args.query);
          } else if (isToolCall("read_file")) {
            output = await this.readFile(args.path);
          } else if (isToolCall("write_file")) {
            output = await this.writeFile(args.path, args.content);
          } else if (isToolCall("read_directory")) {
            output = await this.readDirectory(args.path);
          } else if (isToolCall("delete_file")) {
            output = await this.deleteFile(args.path);
          } else if (isToolCall("run_terminal_command")) {
            output = await this.runTerminalCommand(args.command);
          } else if (isToolCall("search_file_paths")) {
            output = await this.searchFilePaths(args.path);
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
  private searchCodeEmbeddings(query: string) {
    this.onToolCallEventEmitter.fire({
      type: "search_code_embeddings",
      query,
    });

    return this.embedder.searchCodeEmbeddings(query);
  }
  private searchDocEmbeddings(query: string) {
    this.onToolCallEventEmitter.fire({
      type: "search_doc_embeddings",
      query,
    });

    return this.embedder.searchDocEmbeddings(query);
  }
  private async readFile(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: "read_file",
      path: normalizedPath.substring(this.workspacePath.length),
    });

    const content = await fs.readFile(normalizedPath);

    return content.toString();
  }
  private async writeFile(path: string, content: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: "write_file",
      path: normalizedPath.substring(this.workspacePath.length),
      content,
    });

    await fs.writeFile(normalizedPath, content);

    return "ok";
  }
  private readDirectory(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: "read_directory",
      path: normalizedPath.substring(this.workspacePath.length),
    });

    return fs.readdir(normalizedPath);
  }
  private async deleteFile(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: "delete_file",
      path: normalizedPath.substring(this.workspacePath.length),
    });

    await fs.rm(normalizedPath);

    return "ok";
  }
  private async runTerminalCommand(command: string) {
    this.onToolCallEventEmitter.fire({
      type: "run_terminal_command",
      command,
    });

    const { stdout, stderr } = await exec(command);

    return stderr || stdout;
  }

  private async searchFilePaths(path: string) {
    this.onToolCallEventEmitter.fire({
      type: "search_file_paths",
      path,
    });

    const gitignoreGlobs = getGitIgnoreGlobs(this.workspacePath);
    const files = await glob("**/*.*", {
      ignore: defaultIgnores.concat(gitignoreGlobs),
    });

    return files.filter((filepath) => filepath.includes(path));
  }
  dispose() {
    this.onToolCallEventEmitter.dispose();
  }
}
