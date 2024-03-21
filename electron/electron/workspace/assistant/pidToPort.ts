import * as process from "node:process";
import { promisify } from "util";
import { exec } from "child_process";

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
const portColumn =
  process.platform === "darwin" ? 8 : process.platform === "linux" ? 6 : 4;
const isProtocol = (value: string) => /^\s*(tcp|udp)/i.test(value);

const parsePid = (pid?: string) => {
  if (typeof pid !== "string") {
    return;
  }

  const { groups } = /(?:^|",|",pid=)(?<pid>\d+)/.exec(pid) || {};
  if (groups) {
    return Number.parseInt(groups.pid, 10);
  }
};

const getList = async () => {
  const list = await getListFunction();

  return list
    .split("\n")
    .filter((line) => isProtocol(line))
    .map((line) => line.match(/\S+/g) || []) as RegExpMatchArray[];
};

export async function pidToPorts(pid: number) {
  if (!Number.isInteger(pid)) {
    throw new TypeError(`Expected an integer, got ${typeof pid}`);
  }

  const returnValue = new Set();
  const ports = await allPortsWithPid();
  ports.forEach((port, pid_) => {
    if (pid_ === pid) {
      returnValue.add(port);
    }
  });

  return returnValue;
}

export async function allPortsWithPid() {
  const list = await getList();
  const returnValue = new Map<number, number>();

  for (const line of list) {
    const { groups } = /[^]*[.:](?<port>\d+)$/.exec(line[addressColumn]) || {};
    if (groups) {
      returnValue.set(
        Number.parseInt(groups.port, 10),
        parsePid(line[portColumn])
      );
    }
  }

  return returnValue;
}
