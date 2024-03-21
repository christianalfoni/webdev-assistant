import * as path from "path";
import OpenAI from "openai";
// @ts-ignore
import parseGitignore from "gitignore-globs";

export const defaultIgnores = [
  "*.lock",
  "*-lock.json",
  "node_modules/**/*",
  ".embeddings/**/*",
];

export interface IDisposable {
  /**
   * Dispose this object.
   */
  dispose(): void;
}

export class Disposable implements IDisposable {
  protected toDispose: IDisposable[] = [];
  public isDisposed = false;

  public addDisposable<T extends IDisposable>(disposable: T): T {
    this.toDispose.push(disposable);
    return disposable;
  }

  public onDispose(cb: () => void): void {
    this.toDispose.push(Disposable.create(cb));
  }

  public dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.toDispose.forEach((disposable) => {
      disposable.dispose();
    });
  }

  public static is(arg: any): arg is Disposable {
    return typeof arg["dispose"] === "function";
  }

  public static create(cb: () => void): IDisposable {
    return {
      dispose: cb,
    };
  }
}

export interface Event<T> {
  /**
   *
   * @param listener The listener function will be called when the event happens.
   * @return a disposable to remove the listener again.
   */
  (listener: (e: T) => void): IDisposable;
}

export class Emitter<T> {
  private registeredListeners = new Set<(e: T) => void>();
  private _event: Event<T> | undefined;

  get event(): Event<T> {
    if (!this._event) {
      this._event = (listener: (e: T) => void) => {
        this.registeredListeners.add(listener);

        return Disposable.create(() => {
          this.registeredListeners.delete(listener);
        });
      };
    }

    return this._event;
  }

  /** Invoke all listeners registered to this event. */
  fire(event: T): void {
    this.registeredListeners.forEach((listener) => {
      listener(event);
    });
  }

  dispose(): void {
    this.registeredListeners = new Set();
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizePath(workspacePath: string, filepath: string) {
  return path.resolve(workspacePath, filepath);
}

export function getGitIgnoreGlobs(workspacePath: string) {
  try {
    return parseGitignore(path.join(workspacePath, ".gitignore"));
  } catch {
    return [];
  }
}
