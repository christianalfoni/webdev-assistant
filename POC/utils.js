import * as path from "path";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMessageOutput(message) {
  return `${message.role}: ${message.content
    .map((content) => content.text.value)
    .join("\n")}`;
}

export function normalizePath(filepath) {
  return path.resolve(process.cwd(), filepath);
}
