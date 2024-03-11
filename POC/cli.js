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

  prompt();
}

createNewThread();
