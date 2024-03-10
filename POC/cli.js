import inquirer from "inquirer";
import {
  vectorStorePromise,
  searchCodeEmbeddings,
  searchDocEmbeddings,
  readFile,
  writeFile,
  readDirectory,
  deleteFile,
  runTerminalCommand,
  searchFilePaths,
} from "./tools.js";
import { createThread } from "./openai.js";
import { createMessageOutput, normalizePath } from "./utils.js";

await vectorStorePromise;

async function createNewThread() {
  console.log("Creating thread...");

  function prompt() {
    inquirer
      .prompt([
        {
          name: "query",
          message: "user:",
        },
      ])
      .then(async ({ query }) => {
        thread.addMessage(query);
      });
  }

  const thread = await createThread(async (run) => {
    if (run.status === "completed") {
      const messages = await thread.messages;
      console.log(createMessageOutput(messages[0]));
      prompt();
      return;
    }

    if (
      run.status === "requires_action" &&
      run.required_action.type === "submit_tool_outputs"
    ) {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      const toolOutputs = await Promise.all(
        toolCalls.map(async (toolCall) => {
          if (toolCall.type !== "function") {
            throw new Error(
              "Tool call type " + toolCall.type + " is not supported"
            );
          }

          const args = JSON.parse(toolCall.function.arguments);

          let output;

          try {
            if (toolCall.function.name === "search_code_embeddings") {
              console.log(
                "assistant: Searching code embeddings for " + args.query
              );
              output = await searchCodeEmbeddings(args.query);
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
                "assistant: Reading directory " +
                  path.replace(process.cwd(), "")
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
            output:
              typeof output === "string" ? output : JSON.stringify(output),
          };
        })
      );

      thread.submitToolOutputs(run, toolOutputs);

      return;
    }
  });

  prompt();
}

createNewThread();
