import { deferred, streamToReader, streamToWriter } from "./util";
import * as cp from "child_process";
import { readAll } from "./buffer";
import {
  DenoProcess,
  ProcessStatus,
  ReadCloser,
  Signal,
  WriteCloser
} from "./deno";
import { ResourceTable } from "./resources";

export class DenoProcessImpl implements DenoProcess {
  readonly rid: number;
  readonly pid: number;
  readonly stdin?: WriteCloser;
  readonly stdout?: ReadCloser;
  readonly stderr?: ReadCloser;
  statusDeferred = deferred<ProcessStatus>();

  constructor(rid: number, readonly proc: cp.ChildProcess) {
    this.rid = rid;
    this.pid = proc.pid;
    if (proc.stdin) {
      const w = streamToWriter(proc.stdin);
      this.stdin = {
        ...w,
        close(): void {}
      };
    }
    if (proc.stdout) {
      const r = streamToReader(proc.stdout);
      this.stdout = {
        ...r,
        close(): void {}
      };
    }
    if (proc.stderr) {
      const r = streamToReader(proc.stderr);
      this.stderr = {
        ...r,
        close(): void {}
      };
    }
    proc.on("exit", (code, sig) => {
      const status: ProcessStatus = { success: false };
      if (code === 0) {
        status.success = true;
      }
      if (code != null) {
        status.code = code;
      }
      if (sig != null) {
        status.signal = Signal[sig];
      }
      this.statusDeferred.resolve(status);
    });
    proc.on("error", err => this.statusDeferred.reject(err));
  }

  status(): Promise<ProcessStatus> {
    return this.statusDeferred;
  }

  /** Buffer the stdout and return it as Uint8Array after EOF.
   * You must set stdout to "piped" when creating the process.
   * This calls close() on stdout after its done.
   */
  output(): Promise<Uint8Array> {
    return readAll(this.stdout);
  }

  /** Buffer the stderr and return it as Uint8Array after EOF.
   * You must set stderr to "piped" when creating the process.
   * This calls close() on stderr after its done.
   */
  stderrOutput(): Promise<Uint8Array> {
    return readAll(this.stderr);
  }

  close(): void {
    try {
      const st = this.statusDeferred.status();
      if (!st) {
        process.kill(this.pid);
      }
    } finally {
      ResourceTable.delete(this.rid);
    }
  }

  kill(signo: number): void {
    try {
      process.kill(this.pid, signo);
    } finally {
      ResourceTable.delete(this.rid);
    }
  }
}
