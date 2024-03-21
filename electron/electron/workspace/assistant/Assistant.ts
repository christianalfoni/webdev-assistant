import OpenAI from "openai";
import * as fs from "fs/promises";
import { readFileSync } from "fs";
import * as path from "path";

import { AssistantThread } from "./AssistantThread";
import { Emitter } from "../utils";
import { AssistantTools } from "./AssistantTools";
import { Embedder } from "../Embedder";
import watch, { Watcher } from "node-watch";

export class Assistant {
  private onMessageDeltaEmitter = new Emitter<string>();
  onMessageDelta = this.onMessageDeltaEmitter.event;

  get onToolCallEvent() {
    return this.tools.onToolCallEvent;
  }
  get onTerminalOutput() {
    return this.tools.onTerminalOutput;
  }
  get onPortOpened() {
    return this.tools.onPortOpened;
  }

  private currentThread?: AssistantThread;
  private assistantId: string;
  private openai: OpenAI;
  private workspacePath: string;
  private embedder: Embedder;
  private tools;
  private packageJson?: Record<string, unknown>;
  private watcher: Watcher;

  constructor(params: {
    workspacePath: string;
    openai: OpenAI;
    assistantId: string;
    embedder: Embedder;
  }) {
    this.workspacePath = params.workspacePath;
    this.assistantId = params.assistantId;
    this.openai = params.openai;
    this.embedder = params.embedder;
    this.tools = new AssistantTools(this.workspacePath, this.embedder);
    this.watcher = watch(path.join(this.workspacePath));
    this.watcher.on("change", (filepath) => {
      if (filepath.endsWith("package.json")) {
        this.updatePackageJson();
      }
    });
    this.updatePackageJson();
  }

  private async updatePackageJson() {
    let packageJsonContent: string | undefined;
    try {
      packageJsonContent = readFileSync(
        path.join(this.workspacePath, "package.json")
      ).toString();
    } catch {
      console.log("No package json");
      this.packageJson = undefined;
      return;
    }

    try {
      this.packageJson = JSON.parse(packageJsonContent);
    } catch {
      console.log("Not able to parse package json");
    }
  }

  async createNewThread() {
    if (this.currentThread) {
      this.currentThread.dispose();
    }

    const thread = await AssistantThread.create(
      this.openai,
      this.assistantId
      /*
      async (run) => {
        this.onRunStatusUpdateEmitter.fire(run.status);

        if (run.status === "completed") {
          const messages = await thread.messages;
          this.onMessageEmitter.fire(createMessageOutput(messages[0]));
          return;
        }

        if (
          run.status === "requires_action" &&
          run.required_action?.type === "submit_tool_outputs"
        ) {
          const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

          const toolOutputs = await this.tools.handleToolCalls(toolCalls);

          thread.submitToolOutputs(run, toolOutputs);

          return;
        }
        
      }
      */
    );

    thread.onFunctionToolCall(() => {
      // We can show the action before the arguments are sent
    });

    thread.onMessageDelta((text) => {
      this.onMessageDeltaEmitter.fire(text);
    });

    thread.onRequiresAction(async ({ runId, toolCalls }) => {
      const toolOutputs = await this.tools.handleToolCalls(toolCalls);

      thread.submitToolOutputs(runId, toolOutputs);

      return;
    });

    return thread;
  }
  async addMessage(content: string) {
    if (!this.currentThread) {
      this.currentThread = await this.createNewThread();
    }

    const rootContent = await fs.readdir(this.workspacePath);

    let dependencies = "";
    if (this.packageJson && this.packageJson.dependencies) {
      dependencies = `The project has the following dependencies: ${Object.keys(
        this.packageJson.dependencies
      )}.`;
    }

    let scripts = "";
    if (this.packageJson && this.packageJson.scripts) {
      scripts = `The project has the following scripts: ${JSON.stringify(
        this.packageJson.scripts
      )}.`;
    }

    const instructions = `You are a assisting a web developer on a local machine to work on a project in the ${
      this.workspacePath
    } directory. The directory has the following files and folders in the root ${JSON.stringify(
      rootContent
    )}. ${dependencies} ${scripts} You have full access to the environment to do tasks and search embedded code and documentation.`;

    return this.currentThread.addMessage(content, instructions);
  }
  handleTerminalInput(actionId: string, input: string) {
    this.tools.handleTerminalInput(actionId, input);
  }
  handleKillTerminal(actionId: string) {
    this.tools.handleKillTerminal(actionId);
  }
  handleKeepTerminal(actionId: string) {
    this.tools.handleKeepTerminal(actionId);
  }
  dispose() {
    this.embedder.dispose();
    this.tools.dispose();
    this.onMessageDeltaEmitter.dispose();
    this.watcher.close();
  }
}
