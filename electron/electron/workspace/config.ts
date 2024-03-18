import * as fs from "fs";
import * as path from "path";

const configPath = path.join(__dirname, "..", "..", "..", "temp_config.json");

const config = JSON.parse(fs.readFileSync(configPath).toString());

export function getOpenAiApiKey(): string {
  return config.openAiApiKey || "";
}

export function getAssistantId(): string {
  return config.assistantId || "";
}
