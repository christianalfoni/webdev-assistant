import OpenAI from "openai";
import { Disposable, Emitter } from "../utils.js";
// This is for some reason not available on the OpenAI namespaces
import type { AssistantStream } from "openai/lib/AssistantStream.js";

export type RunCallback = (run: OpenAI.Beta.Threads.Run) => void;

export class AssistantThread {
  static async create(openai: OpenAI, assistantId: string) {
    const thread = await openai.beta.threads.create();

    return new AssistantThread({
      assistantId,
      thread,
      openai,
    });
  }
  private openai: OpenAI;
  private assistantId: string;
  private thread: OpenAI.Beta.Thread;

  private onFunctionToolCallEmitter =
    new Emitter<OpenAI.Beta.Threads.Runs.Steps.FunctionToolCall>();
  onFunctionToolCall = this.onFunctionToolCallEmitter.event;

  private onRequiresActionEmitter = new Emitter<{
    runId: string;
    toolCalls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[];
  }>();
  onRequiresAction = this.onRequiresActionEmitter.event;

  private onMessageDeltaEmitter = new Emitter<string>();
  onMessageDelta = this.onMessageDeltaEmitter.event;

  private currentStream?: AssistantStream;

  constructor(params: {
    openai: OpenAI;
    assistantId: string;
    thread: OpenAI.Beta.Thread;
  }) {
    this.openai = params.openai;
    this.assistantId = params.assistantId;
    this.thread = params.thread;
  }

  private observeStream(stream: AssistantStream) {
    this.currentStream = stream;

    let isCreatingUrl = false;
    let buffer = "";

    stream
      .on("end", () => {
        const currentRun = stream.currentRun();

        if (
          currentRun.status === "requires_action" &&
          currentRun.required_action.type === "submit_tool_outputs"
        ) {
          const toolCalls =
            currentRun.required_action.submit_tool_outputs.tool_calls;

          this.onRequiresActionEmitter.fire({
            runId: currentRun.id,
            toolCalls,
          });
        }
      })
      .on("textDelta", (text) => {
        if (!text.value) {
          return;
        }

        if (text.value.includes("[")) {
          buffer += text.value;
          isCreatingUrl = true;
          console.log("Creating URL");
          return;
        }

        if (
          isCreatingUrl &&
          (text.value.includes(")") || text.value.includes(" "))
        ) {
          this.onMessageDeltaEmitter.fire(buffer + text.value);
          buffer = "";
          isCreatingUrl = false;
          console.log("Not creating url anymore");

          return;
        }

        if (isCreatingUrl) {
          buffer += text.value;

          return;
        }

        // The first delta is the created message value
        if (text.value) {
          this.onMessageDeltaEmitter.fire(text.value);
        }
      })
      .on("toolCallCreated", (toolCall) => {
        if (toolCall.type !== "function") {
          throw new Error("Got a non function tool call: " + toolCall.type);
        }

        this.onFunctionToolCallEmitter.fire(toolCall);
      });

    return stream.finalMessages();
  }

  async addMessage(content: string, instructions: string) {
    await this.openai.beta.threads.messages.create(this.thread.id, {
      role: "user",
      content,
    });

    const stream = this.openai.beta.threads.runs.createAndStream(
      this.thread.id,
      {
        instructions,
        assistant_id: this.assistantId,
      }
    );

    return this.observeStream(stream);
  }

  get messages() {
    return this.openai.beta.threads.messages
      .list(this.thread.id)
      .then((response) => response.data);
  }

  async submitToolOutputs(
    runId: string,
    toolOutputs: OpenAI.Beta.Threads.RunSubmitToolOutputsParams.ToolOutput[]
  ) {
    const stream = this.openai.beta.threads.runs.submitToolOutputsStream(
      this.thread.id,
      runId,
      {
        tool_outputs: toolOutputs,
      }
    );

    return this.observeStream(stream);
  }

  dispose() {
    this.onFunctionToolCallEmitter.dispose();
    this.currentStream?.abort();
  }
}
