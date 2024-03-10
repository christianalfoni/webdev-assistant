import * as fs from "fs/promises";
import * as path from "path";
import * as util from "util";
import * as cp from "child_process";
import parseGitignore from "gitignore-globs";
import { glob } from "glob";

const exec = util.promisify(cp.exec);

import { getVectorStore } from "./embedding.js";

export const vectorStorePromise = getVectorStore();

export async function searchCodeEmbeddings(query) {
  const vectorStore = await vectorStorePromise;

  return vectorStore.similaritySearchWithScore(
    query,
    10,
    (doc) => doc.metadata.type === "code"
  );
}

export async function searchDocEmbeddings(query) {
  const vectorStore = await vectorStorePromise;

  return vectorStore.similaritySearchWithScore(
    query,
    10,
    (doc) => doc.metadata.type === "doc"
  );
}

export async function readFile(filepath) {
  const content = await fs.readFile(filepath);

  return content.toString();
}

export function readDirectory(directorypath) {
  return fs.readdir(directorypath);
}

export async function writeFile(filepath, content) {
  await fs.writeFile(filepath, content);

  return "ok";
}

export async function deleteFile(filepath) {
  await fs.deleteFile(filepath);

  return "ok";
}

export async function runTerminalCommand(command) {
  const { stdout, stderr } = await exec(command);

  return stderr || stdout;
}

export async function searchFilePaths(query) {
  const gitignoreGlobs = parseGitignore(".gitignore");
  const files = await glob("**/*.*", {
    ignore: defaultIgnores.concat(gitignoreGlobs),
  });

  return files.filter((filepath) => filepath.includes(query));
}
