import * as process from "node:process";
import { promisify } from "util";
import { exec } from "child_process";
import * as cp from "child_process";
import debounce from "debounce";
import { Emitter } from "../utils";

type PortDetectorState =
  | {
      status: "IDLE";
    }
  | {
      status: "POLLING";
      interval: NodeJS.Timeout;
    };

export class PortDetector {
  private state: PortDetectorState = {
    status: "IDLE",
  };

  private onPortEmitter = new Emitter<number>();
  private lastPorts = new Set<number>();
  private refCount = 0;
  onPort = this.onPortEmitter.event;
  private async poll() {
    console.log("Polled...");
    const ports = await getPorts();

    if (this.state.status === "POLLING") {
      const newPorts = Array.from(ports).filter((x) => !this.lastPorts.has(x));

      this.lastPorts = ports;

      if (newPorts[0]) {
        this.onPortEmitter.fire(newPorts[0]);
      }
    }
  }
  async start() {
    this.refCount++;
    console.log("Starting", this.refCount);
    if (this.refCount === 1) {
      this.lastPorts = await getPorts();
      console.log("Listening for ports");
      this.state = {
        status: "POLLING",
        interval: setInterval(() => this.poll(), 1000),
      };
    }
  }
  stop() {
    this.refCount--;

    console.log("Stopping", this.refCount);
    if (!this.refCount && this.state.status === "POLLING") {
      clearInterval(this.state.interval);

      this.state = {
        status: "IDLE",
      };
    }
  }
  dispose() {
    this.stop();
    this.onPortEmitter.dispose();
  }
}

const execa = promisify(exec);

const netstat = async (type: string) => {
  const { stdout } = await execa(`netstat -anv -p ${type}`);
  return stdout;
};

const macos = async () => {
  const result = await Promise.all([netstat("tcp"), netstat("udp")]);

  return result.join("\n");
};

const linux = async () => {
  const { stdout } = await execa("ss -tunlp");
  return stdout;
};

const windows = async () => {
  const { stdout } = await execa("netstat -ano");
  return stdout;
};

const getListFunction =
  process.platform === "darwin"
    ? macos
    : process.platform === "linux"
    ? linux
    : windows;
const addressColumn =
  process.platform === "darwin" ? 3 : process.platform === "linux" ? 4 : 1;
const isProtocol = (value: string) => /^\s*(tcp|udp)/i.test(value);

export const getList = async () => {
  const list = await getListFunction();

  return list
    .split("\n")
    .filter((line) => isProtocol(line))
    .map((line) => line.match(/\S+/g) || []);
};

export async function getPorts() {
  const list = await getList();
  const returnValue = new Set<number>();

  for (const line of list) {
    const { groups } = /[^]*[.:](?<port>\d+)$/.exec(line[addressColumn]) || {};

    if (!groups) {
      continue;
    }

    const port = Number.parseInt(groups.port, 10);

    if (port) {
      returnValue.add(port);
    }
  }

  return returnValue;
}

export function onPort() {}
