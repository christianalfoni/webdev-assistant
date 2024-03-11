import OpenAI from "openai";

import { Disposable, EventEmitter } from "vscode";
import { AssistantThread } from "./AssistantThread";
import { createMessageOutput } from "./utils";
import { AssistantTools } from "./AssistantTools";

type RunStatus = OpenAI.Beta.Threads.Run["status"];

export class WorkspaceAssistant implements Disposable {
  private onRunStatusUpdateEmitter = new EventEmitter<RunStatus>();
  onRunStatusUpdate = this.onRunStatusUpdateEmitter.event;
  private onMessageEmitter = new EventEmitter<string>();
  onMessage = this.onMessageEmitter.event;

  private currentThread?: AssistantThread;
  private tools = new AssistantTools();

  constructor(private workspacePath: string) {}

  async createNewThread() {
    if (this.currentThread) {
      this.currentThread.dispose();
    }

    const thread = (this.currentThread = await AssistantThread.create(
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

          const toolOutputs = this.tools.handleToolCalls(toolCalls);

          thread.submitToolOutputs(run, toolOutputs);

          return;
        }
      }
    ));
  }
  addMessage() {
    // `You are a web developer working on a project in the ${process.cwd()} directory. The project code is embedded and you can search the embeddings to get more context.`,
  }
  dispose() {}
}
