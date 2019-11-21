import { Conn } from "./net";
import { DenoFile, DenoProcess, ResourceMap } from "./deno";
import * as fs from "fs";
import * as cp from "child_process";
import { DenoProcessImpl } from "./process";
import { DenoFileImpl } from "./file";
export interface ResourceTable {
  openFile(file: fs.promises.FileHandle): DenoFile;
  openProcess(proc: cp.ChildProcess): DenoProcess;
  getFile(rid: number): DenoFile;
  getProcess(rid: number): DenoProcess;
  map(): ResourceMap;
  close(rid: number): void;
  delete(rid: number): void;
}
function resourceTable(): ResourceTable {
  const files: Map<number, DenoFileImpl> = new Map();
  const processes: Map<number, DenoProcessImpl> = new Map();
  const conns: Map<number, Conn> = new Map();
  let resourceId = 3;
  function openFile(file: fs.promises.FileHandle): DenoFile {
    const rid = resourceId++;
    const ret = new DenoFileImpl(rid, file);
    files.set(rid, ret);
    return ret;
  }
  function openProcess(proc: cp.ChildProcess): DenoProcess {
    const rid = resourceId++;
    const ret = new DenoProcessImpl(rid, proc);
    processes.set(rid, ret);
    return ret;
  }
  function close(rid: number) {
    if (files.has(rid)) {
      const file = files.get(rid);
      file.close();
    } else if (processes.has(rid)) {
      const proc = processes.get(rid);
      proc.close();
    } else if (conns.has(rid)) {
      const conn = conns.get(rid);
      conn.close();
    }
  }
  function del(rid: number) {
    if (files.has(rid)) {
      files.delete(rid);
    } else if (processes.has(rid)) {
      processes.delete(rid);
    } else if (conns.has(rid)) {
      processes.delete(rid);
    }
  }
  function getFile(rid: number): DenoFile {
    const file = files.get(rid);
    if (!file) {
      throw new Error("file not found: rid=" + rid);
    }
    return file;
  }
  function getProcess(rid: number): DenoProcess {
    const proc = processes.get(rid);
    if (!proc) {
      throw new Error("process not found: rid=" + rid);
    }
    return;
  }
  function map(): ResourceMap {
    return Object.fromEntries([
      ...[...files.entries()].map(e => [e[0], "file"]),
      ...[...processes.entries()].map(e => [e[0], "process"]),
      ...[...conns.entries()].map(e => [e[0], "conn"])
    ]);
  }
  return {
    getFile,
    getProcess,
    openFile,
    openProcess,
    close,
    delete: del,
    map
  };
}

export const ResourceTable = resourceTable();
