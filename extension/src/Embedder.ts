import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { LocalIndex } from "vectra";

import { glob } from "glob";
import { defaultIgnores, getGitIgnoreGlobs } from "./utils";
import OpenAI from "openai";

const EMBEDDINGS_FOLDER_NAME = ".embeddings";

const docExtensions = [".md", ".mdx"];
const codeExtensions = [".js", ".mjs", ".jsx", ".ts", ".tsx"];

function getIndexTypeFromFilepath(filepath: string) {
  const extension = path.extname(filepath);

  return codeExtensions.includes(extension) ? "code" : "doc";
}

export class Embedder {
  static MODEL_NAME = "text-embedding-3-small";
  static async load(workspacePath: string, openai: OpenAI) {
    const directory = path.join(workspacePath, EMBEDDINGS_FOLDER_NAME);
    const index = new LocalIndex(directory);
    const isIndexCreated = await index.isIndexCreated();
    const getVector = async (text: string) => {
      const response = await openai.embeddings.create({
        model: Embedder.MODEL_NAME,
        input: text,
      });
      return response.data[0].embedding;
    };

    if (!isIndexCreated) {
      await index.createIndex();

      console.log("Creating embedding...");
      const gitignoreGlobs = getGitIgnoreGlobs(workspacePath);

      const files = await glob("**/*.*", {
        ignore: defaultIgnores.concat(gitignoreGlobs),
        cwd: workspacePath,
      });

      await Promise.all(
        files.map(async (filepath) => {
          const extension = path.extname(filepath);

          if (
            !codeExtensions.includes(extension) &&
            !docExtensions.includes(extension)
          ) {
            return;
          }

          const pageContent = (
            await fs.readFile(path.join(workspacePath, filepath))
          ).toString();

          const type = getIndexTypeFromFilepath(filepath);

          console.log("Creating vector for " + filepath);
          try {
            await index.insertItem({
              id: filepath,
              vector: await getVector(pageContent),
              metadata: { filepath, type },
            });
          } catch {
            console.log("Failed creating vector for " + filepath);
          }
        })
      );
    }

    return new Embedder(workspacePath, index, getVector);
  }

  private watcher = vscode.workspace.createFileSystemWatcher("**/*.*");

  constructor(
    workspacePath: string,
    private index: LocalIndex,
    private getVector: (text: string) => Promise<number[]>
  ) {
    this.watcher.onDidChange(async (event) => {
      const extension = path.extname(event.fsPath);

      if (
        event.fsPath.startsWith(workspacePath) &&
        (codeExtensions.includes(extension) ||
          docExtensions.includes(extension))
      ) {
        const pageContent = (await fs.readFile(event.fsPath)).toString();
        const filepath = event.fsPath.substring(workspacePath.length + 1);
        const type = getIndexTypeFromFilepath(filepath);
        console.log("Updating index item " + filepath);
        await index.upsertItem({
          id: filepath,
          vector: await getVector(pageContent),
          metadata: { filepath, type },
        });
      }
    });
    this.watcher.onDidCreate(async (event) => {
      const extension = path.extname(event.fsPath);

      if (
        event.fsPath.startsWith(workspacePath) &&
        (codeExtensions.includes(extension) ||
          docExtensions.includes(extension))
      ) {
        const pageContent = (await fs.readFile(event.fsPath)).toString();
        const filepath = event.fsPath.substring(workspacePath.length + 1);
        const type = getIndexTypeFromFilepath(filepath);
        console.log("Adding index item " + filepath);
        await index.insertItem({
          id: filepath,
          vector: await getVector(pageContent),
          metadata: { filepath, type },
        });
      }
    });
    this.watcher.onDidDelete(async (event) => {
      const extension = path.extname(event.fsPath);

      if (
        event.fsPath.startsWith(workspacePath) &&
        (codeExtensions.includes(extension) ||
          docExtensions.includes(extension))
      ) {
        const filepath = event.fsPath.substring(workspacePath.length + 1);
        console.log("Deleting index item " + filepath);
        await index.deleteItem(filepath);
      }
    });
  }
  async searchCodeEmbeddings(query: string) {
    const vector = await this.getVector(query);

    return this.index.queryItems(vector, 3, {
      type: "code",
    });
  }
  async searchDocEmbeddings(query: string) {
    const vector = await this.getVector(query);

    return this.index.queryItems(vector, 3, {
      type: "doc",
    });
  }
  dispose() {
    this.watcher.dispose();
  }
}
