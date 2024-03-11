import OpenAI from "openai";
import { sleep } from "./utils.js";
import { getAssistantId } from "./config.js";

const POLL_RUN_SLEEP_MS = 500;
const ASSISTANT_ID = getAssistantId();
const openai = new OpenAI();

export type RunCallback = (run: OpenAI.Beta.Threads.Run) => void;

export class AssistantThread {
  static async create(onUpdate: RunCallback) {
    const thread = await openai.beta.threads.create();
    return new AssistantThread(thread, onUpdate);
  }
  private isPolling = false;
  constructor(
    private thread: OpenAI.Beta.Thread,
    private onUpdate: RunCallback
  ) {}
  private async poll(run: OpenAI.Beta.Threads.Run) {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    while (true) {
      const updatedRun = await openai.beta.threads.runs.retrieve(
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
    const messageResponse = await openai.beta.threads.messages.create(
      this.thread.id,
      {
        role: "user",
        content,
      }
    );

    const run = await openai.beta.threads.runs.create(this.thread.id, {
      instructions,
      assistant_id: ASSISTANT_ID,
    });

    this.poll(run);

    return messageResponse;
  }

  get messages() {
    return openai.beta.threads.messages
      .list(this.thread.id)
      .then((response) => response.data);
  }

  async submitToolOutputs(
    run: OpenAI.Beta.Threads.Run,
    toolOutputs: OpenAI.Beta.Threads.RunSubmitToolOutputsParams.ToolOutput[]
  ) {
    const toolOutputsResponse =
      await openai.beta.threads.runs.submitToolOutputs(this.thread.id, run.id, {
        tool_outputs: toolOutputs,
      });

    this.poll(run);

    return toolOutputsResponse;
  }

  dispose() {}
}
