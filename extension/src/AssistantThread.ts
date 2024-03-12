import OpenAI from "openai";
import { sleep } from "./utils.js";

const POLL_RUN_SLEEP_MS = 500;

export type RunCallback = (run: OpenAI.Beta.Threads.Run) => void;

export class AssistantThread {
  static async create(
    openAiApiKey: string,
    assistantId: string,
    onUpdate: RunCallback
  ) {
    const openai = new OpenAI({
      apiKey: openAiApiKey,
    });
    const thread = await openai.beta.threads.create();

    return new AssistantThread({
      assistantId,
      thread,
      onUpdate,
      openai,
    });
  }
  private openai: OpenAI;
  private assistantId: string;
  private thread: OpenAI.Beta.Thread;
  private onUpdate: RunCallback;
  private isPolling = false;
  constructor(params: {
    openai: OpenAI;
    assistantId: string;
    thread: OpenAI.Beta.Thread;
    onUpdate: RunCallback;
  }) {
    this.openai = params.openai;
    this.assistantId = params.assistantId;
    this.thread = params.thread;
    this.onUpdate = params.onUpdate;
  }
  private async poll(run: OpenAI.Beta.Threads.Run) {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    while (true) {
      const updatedRun = await this.openai.beta.threads.runs.retrieve(
        this.thread.id,
        run.id
      );

      this.onUpdate(updatedRun);

      if (
        updatedRun.status === "in_progress" ||
        updatedRun.status === "queued" ||
        updatedRun.status === "cancelling"
      ) {
        sleep(POLL_RUN_SLEEP_MS);
      } else {
        this.isPolling = false;
        break;
      }
    }
  }
  async addMessage(content: string, instructions: string) {
    const messageResponse = await this.openai.beta.threads.messages.create(
      this.thread.id,
      {
        role: "user",
        content,
      }
    );

    const run = await this.openai.beta.threads.runs.create(this.thread.id, {
      instructions,
      assistant_id: this.assistantId,
    });

    this.poll(run);

    return messageResponse;
  }

  get messages() {
    return this.openai.beta.threads.messages
      .list(this.thread.id)
      .then((response) => response.data);
  }

  async submitToolOutputs(
    run: OpenAI.Beta.Threads.Run,
    toolOutputs: OpenAI.Beta.Threads.RunSubmitToolOutputsParams.ToolOutput[]
  ) {
    const toolOutputsResponse =
      await this.openai.beta.threads.runs.submitToolOutputs(
        this.thread.id,
        run.id,
        {
          tool_outputs: toolOutputs,
        }
      );

    this.poll(run);

    return toolOutputsResponse;
  }

  dispose() {}
}
