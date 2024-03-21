import OpenAI from "openai";
import * as fs from "fs/promises";

import { AssistantThread } from "./AssistantThread";
import { Emitter, createMessageOutput } from "../utils";
import { AssistantTools } from "./AssistantTools";
import { Embedder } from "../Embedder";

export class Assistant {
  private onMessageDeltaEmitter = new Emitter<string>();
  onMessageDelta = this.onMessageDeltaEmitter.event;

  get onToolCallEvent() {
    return this.tools.onToolCallEvent;
  }
  get onTerminalOutput() {
    return this.tools.onTerminalOutput;
  }

  private currentThread?: AssistantThread;
  private assistantId: string;
  private openai: OpenAI;
  private workspacePath: string;
  private embedder: Embedder;
  private tools;

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

    const instructions = `You are a assisting a web developer on a local machine to work on a project in the ${
      this.workspacePath
    } directory. The directory has the following files and folders in the root ${JSON.stringify(
      rootContent
    )}. You have full access to the environment to do tasks and search embedded code and documentation.`;

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
  }
}
