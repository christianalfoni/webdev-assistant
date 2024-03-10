import OpenAI from "openai";
import { sleep } from "./utils.js";

const ASSISTANT_ID = "asst_oZq8NZumPoVpT18YlYPYrJQu";
const POLL_RUN_SLEEP_MS = 500;
const openai = new OpenAI();

class Thread {
  thread;
  onUpdate;
  isPolling = false;
  constructor(thread, onUpdate) {
    this.thread = thread;
    this.onUpdate = onUpdate;
  }
  async poll(run) {
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
  async addMessage(content) {
    const messageResponse = await openai.beta.threads.messages.create(
      this.thread.id,
      {
        role: "user",
        content,
      }
    );

    const run = await openai.beta.threads.runs.create(this.thread.id, {
      instructions: `You are a web developer working on a project in the ${process.cwd()} directory. The project code is embedded and you can search the embeddings to get more context.`,
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

  async submitToolOutputs(run, toolOutputs) {
    const toolOutputsResponse =
      await openai.beta.threads.runs.submitToolOutputs(this.thread.id, run.id, {
        tool_outputs: toolOutputs,
      });

    this.poll(run);

    return toolOutputsResponse;
  }
}

export async function createThread(onUpdate) {
  const thread = await openai.beta.threads.create();
  return new Thread(thread, onUpdate);
}
