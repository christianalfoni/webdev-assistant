import OpenAI from "openai";
import { EventEmitter } from "vscode";

export enum ToolCallType {
  SEARCH_CODE_EMBEDDINGS = "search_code_embeddings",
}

export type ToolCallEvent = {
  type: ToolCallType.SEARCH_CODE_EMBEDDINGS;
  query: string;
};

export class AssistantTools {
  private onToolCallEventEmitter = new EventEmitter<ToolCallEvent>();
  onToolCallEvent = this.onToolCallEventEmitter.event;

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
            console.log(
              "assistant: Searching doc embeddings for " + args.query
            );
            output = await searchDocEmbeddings(args.query);
          } else if (toolCall.function.name === "read_file") {
            const path = normalizePath(args.path);
            console.log(
              "assistant: Reading file " + path.replace(process.cwd(), "")
            );
            output = await readFile(path);
          } else if (toolCall.function.name === "write_file") {
            const path = normalizePath(args.path);
            console.log(
              "assistant: Writing file " + path.replace(process.cwd(), "")
            );
            output = await writeFile(path, args.content);
          } else if (toolCall.function.name === "read_directory") {
            const path = normalizePath(args.path);
            console.log(
              "assistant: Reading directory " + path.replace(process.cwd(), "")
            );
            output = await readDirectory(path);
          } else if (toolCall.function.name === "delete_file") {
            const path = normalizePath(args.path);
            console.log(
              "assistant: Deleting file " + path.replace(process.cwd(), "")
            );
            output = await deleteFile(path);
          } else if (toolCall.function.name === "run_terminal_command") {
            console.log("assistant: Running command " + args.command);
            output = await runTerminalCommand(args.command);
          } else if (toolCall.function.name === "search_file_paths") {
            console.log("assistant: Searching file path " + args.path);
            output = await search_file_paths(args.path);
          } else {
            throw new Error("Not implemented " + toolCall.function.name);
          }
        } catch (error) {
          output = error.message;
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

    return searchCodeEmbeddings(query);
  }
}
