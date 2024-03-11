import OpenAI from "openai";
import { EventEmitter } from "vscode";
import * as fs from "fs/promises";
import * as util from "util";
import * as cp from "child_process";
import { Embedder } from "./Embedder";
import { defaultIgnores, normalizePath } from "./utils";
// @ts-ignore
import parseGitignore from "gitignore-globs";
import { glob } from "glob";

const exec = util.promisify(cp.exec);

export enum ToolCallType {
  SEARCH_CODE_EMBEDDINGS = "search_code_embeddings",
  SEARCH_DOC_EMBEDDINGS = "search_doc_embeddings",
  READ_FILE = "read_file",
  WRITE_FILE = "write_file",
  READ_DIRECTORY = "read_directory",
  DELETE_FILE = "delete_file",
  RUN_TERMINAL_COMMAND = "run_terminal_command",
  SEARCH_FILE_PATHS = "search_file_paths",
}

export type ToolCallEvent =
  | {
      type: ToolCallType.SEARCH_CODE_EMBEDDINGS;
      query: string;
    }
  | {
      type: ToolCallType.SEARCH_DOC_EMBEDDINGS;
      query: string;
    }
  | {
      type: ToolCallType.READ_FILE;
      path: string;
    }
  | {
      type: ToolCallType.WRITE_FILE;
      path: string;
      content: string;
    }
  | {
      type: ToolCallType.READ_DIRECTORY;
      path: string;
    }
  | {
      type: ToolCallType.DELETE_FILE;
      path: string;
    }
  | {
      type: ToolCallType.RUN_TERMINAL_COMMAND;
      command: string;
    }
  | {
      type: ToolCallType.SEARCH_FILE_PATHS;
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

        try {
          if (toolCall.function.name === ToolCallType.SEARCH_CODE_EMBEDDINGS) {
            output = await this.searchCodeEmbeddings(args.query);
          } else if (toolCall.function.name === "search_doc_embeddings") {
            output = await this.searchDocEmbeddings(args.query);
          } else if (toolCall.function.name === "read_file") {
            output = await this.readFile(args.path);
          } else if (toolCall.function.name === "write_file") {
            output = await this.writeFile(args.path, args.content);
          } else if (toolCall.function.name === "read_directory") {
            output = await this.readDirectory(args.path);
          } else if (toolCall.function.name === "delete_file") {
            output = await this.deleteFile(args.path);
          } else if (toolCall.function.name === "run_terminal_command") {
            output = await this.runTerminalCommand(args.command);
          } else if (toolCall.function.name === "search_file_paths") {
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
      type: ToolCallType.SEARCH_CODE_EMBEDDINGS,
      query,
    });

    return this.embedder.searchCodeEmbeddings(query);
  }
  private searchDocEmbeddings(query: string) {
    this.onToolCallEventEmitter.fire({
      type: ToolCallType.SEARCH_DOC_EMBEDDINGS,
      query,
    });

    return this.embedder.searchDocEmbeddings(query);
  }
  private async readFile(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: ToolCallType.READ_FILE,
      path: normalizedPath.substring(this.workspacePath.length),
    });

    const content = await fs.readFile(normalizedPath);

    return content.toString();
  }
  private async writeFile(path: string, content: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: ToolCallType.WRITE_FILE,
      path: normalizedPath.substring(this.workspacePath.length),
      content,
    });

    await fs.writeFile(normalizedPath, content);

    return "ok";
  }
  private readDirectory(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: ToolCallType.READ_DIRECTORY,
      path: normalizedPath.substring(this.workspacePath.length),
    });

    return fs.readdir(normalizedPath);
  }
  private async deleteFile(path: string) {
    const normalizedPath = normalizePath(this.workspacePath, path);

    this.onToolCallEventEmitter.fire({
      type: ToolCallType.DELETE_FILE,
      path: normalizedPath.substring(this.workspacePath.length),
    });

    await fs.rm(normalizedPath);

    return "ok";
  }
  private async runTerminalCommand(command: string) {
    this.onToolCallEventEmitter.fire({
      type: ToolCallType.RUN_TERMINAL_COMMAND,
      command,
    });

    const { stdout, stderr } = await exec(command);

    return stderr || stdout;
  }

  private async searchFilePaths(path: string) {
    const gitignoreGlobs = parseGitignore(".gitignore");
    const files = await glob("**/*.*", {
      ignore: defaultIgnores.concat(gitignoreGlobs),
    });

    return files.filter((filepath) => filepath.includes(path));
  }
}
