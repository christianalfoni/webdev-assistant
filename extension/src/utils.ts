import * as path from "path";
import OpenAI from "openai";
// @ts-ignore
import parseGitignore from "gitignore-globs";

export const defaultIgnores = [
  "*.lock",
  "*-lock.json",
  "node_modules/**",
  ".embeddings/**",
];

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMessageOutput(
  message: OpenAI.Beta.Threads.ThreadMessage
) {
  return `${message.content
    .map((content) =>
      content.type === "text" ? content.text.value : "Image Not Available"
    )
    .join("\n")}`;
}

export function normalizePath(workspacePath: string, filepath: string) {
  return path.resolve(workspacePath, filepath);
}

export function getGitIgnoreGlobs(workspacePath: string) {
  try {
    return parseGitignore(path.join(workspacePath, ".gitignore"));
  } catch {
    return [];
  }
}
