import * as path from "path";
import * as fs from "fs/promises";
import { LocalIndex } from "vectra";
import { minimatch } from "minimatch";
import watch, { Watcher } from "node-watch";

import { glob } from "glob";
import { Emitter, defaultIgnores, getGitIgnoreGlobs } from "./utils";
import OpenAI from "openai";
import { EmbedderState } from "./types";

const EMBEDDINGS_FOLDER_NAME = ".embeddings";

const docExtensions = [".md", ".mdx"];
const codeExtensions = [
  ".js",
  ".cjs",
  ".mjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".html",
  ".css",
];

function getIndexTypeFromFilepath(filepath: string) {
  const extension = path.extname(filepath);

  return codeExtensions.includes(extension) ? "code" : "doc";
}

type QueueItem = () => Promise<unknown>;

type QueueState = "IDLE" | "RUNNING";

class EmbeddingQueue {
  private onStateChangeEmitter = new Emitter<QueueState>();
  onStateChange = this.onStateChangeEmitter.event;
  private _state: QueueState = "IDLE";
  get state() {
    return this._state;
  }
  set state(newState) {
    this._state = newState;
    this.onStateChangeEmitter.fire(newState);
  }
  private queue: QueueItem[] = [];
  private async run() {
    this.state = "RUNNING";

    while (true) {
      const nextItem = this.queue[0];

      if (!nextItem) {
        this.state = "IDLE";
        return;
      }

      await nextItem();

      this.queue.shift();
    }
  }
  add(item: QueueItem) {
    this.queue.push(item);

    if (this.queue.length === 1) {
      this.run();
    }
  }
  clear() {
    this.queue = [];
    this.state = "IDLE";
  }
  dispose() {
    this.clear();
    this.onStateChangeEmitter.dispose();
  }
}

export class Embedder {
  static MODEL_NAME = "text-embedding-3-small";
  private watcher?: Watcher;
  private queue = new EmbeddingQueue();
  private onStateChangeEmitter = new Emitter<EmbedderState>();
  onStateChange = this.onStateChangeEmitter.event;
  private _state: EmbedderState = "CREATING";
  get state() {
    return this._state;
  }
  set state(newState) {
    this._state = newState;
    this.onStateChangeEmitter.fire(newState);
  }

  private index: LocalIndex;

  constructor(private workspacePath: string, private openai: OpenAI) {
    const directory = path.join(workspacePath, EMBEDDINGS_FOLDER_NAME);
    this.index = new LocalIndex(directory);

    this.queue.onStateChange((state) => {
      if (state === "IDLE") {
        this.state = "READY";
      } else {
        this.state = "UPDATING";
      }
    });

    this.queue.add(() => this.initialize());
  }
  private async getVector(text: string) {
    const response = await this.openai.embeddings.create({
      model: Embedder.MODEL_NAME,
      input: text,
    });

    return response.data[0].embedding;
  }
  private isValidFilepath(absolutePath: string, ignores: string[]) {
    const extension = path.extname(absolutePath);

    if (
      !codeExtensions.includes(extension) &&
      !docExtensions.includes(extension)
    ) {
      return undefined;
    }

    const relativePath = absolutePath.startsWith(this.workspacePath)
      ? absolutePath.substring(this.workspacePath.length + 1)
      : undefined;

    if (!relativePath) {
      return;
    }

    for (const ignoreGlob of ignores) {
      // gitignore can have reverted checks, which we ignore in this context or we'll get a match on any file
      if (ignoreGlob.startsWith("!")) {
        continue;
      }

      if (
        minimatch(relativePath, ignoreGlob, {
          // There can be dots in the path
          dot: true,
        })
      ) {
        return undefined;
      }
    }

    return relativePath;
  }
  private async initialize() {
    const gitignoreGlobs = getGitIgnoreGlobs(this.workspacePath);
    const ignoreGlobs = defaultIgnores.concat(gitignoreGlobs);

    console.log("Creating initial embeddings...");

    const isIndexCreated = await this.index.isIndexCreated();

    if (!isIndexCreated) {
      await this.index.createIndex();
    }

    this.state = "UPDATING";

    /**
     * Register watcher
     */

    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(
      this.workspacePath,
      { recursive: true },
      async (event, fsPath) => {
        const filepath = this.isValidFilepath(fsPath, ignoreGlobs);

        if (!filepath) {
          return;
        }

        try {
          const pageContent = (await fs.readFile(fsPath)).toString();
          const vector = await this.getVector(pageContent);
          const type = getIndexTypeFromFilepath(filepath);

          if (fsPath.startsWith(EMBEDDINGS_FOLDER_NAME)) {
            this.queue.clear();

            return this.queue.add(() => this.initialize());
          }

          this.queue.add(() =>
            event === "update"
              ? this.index.upsertItem({
                  id: filepath,
                  vector,
                  metadata: { filepath, type },
                })
              : this.index.deleteItem(filepath)
          );
        } catch (error) {
          console.log("Could update update file in Embedder", filepath, error);
        }
      }
    );

    /**
     * Embed current files
     */
    const files = await glob("**/*.*", {
      ignore: ignoreGlobs,
      cwd: this.workspacePath,
    });

    const filesToEmbed = files.filter(async (filepath) => {
      const extension = path.extname(filepath);

      if (
        !codeExtensions.includes(extension) &&
        !docExtensions.includes(extension)
      ) {
        return false;
      }

      return true;
    });

    const evaluatedFiles = await Promise.all(
      filesToEmbed.map(async (filepath) => {
        const pageContent = (
          await fs.readFile(path.join(this.workspacePath, filepath))
        ).toString();

        const type = getIndexTypeFromFilepath(filepath);

        return {
          filepath,
          pageContent,
          type,
        };
      })
    );

    evaluatedFiles.forEach(({ pageContent, filepath, type }) => {
      this.queue.add(async () => {
        try {
          const vector = await this.getVector(pageContent);

          await this.index.upsertItem({
            id: filepath,
            vector,
            metadata: { filepath, type },
          });

          console.log("Generated emebdding for", filepath);
        } catch (error) {
          console.log("Could not embed ", filepath);
        }
      });
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
    this.watcher?.close();
    this.queue.dispose();
  }
}
