import { promisify, inspect as nodeInspect } from "util";

const os = require("os");
const cp = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");
import { Stats } from "fs";
import { ChildProcess } from "child_process";
import { concatBytes, deferred, streamToReader, streamToWriter } from "./util";

// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />

// @url js/os.d.ts

/** The current process id of the runtime. */
export let pid: number = process.pid;
/** Reflects the NO_COLOR environment variable: https://no-color.org/ */
export let noColor: boolean = true;

/** Check if running in terminal.
 *
 *       console.log(Deno.isTTY().stdout);
 */
export function isTTY(): {
  stdin: boolean;
  stdout: boolean;
  stderr: boolean;
} {
  return {
    stdin: process.stdin.isTTY,
    stdout: process.stdout.isTTY,
    stderr: process.stderr.isTTY
  };
}

/** Get the hostname.
 * Requires the `--allow-env` flag.
 *
 *       console.log(Deno.hostname());
 */
export function hostname(): string {
  return os.hostname();
}

/** Exit the Deno process with optional exit code. */
export function exit(code?: number): void {
  process.exit(code);
}

/** Returns a snapshot of the environment variables at invocation. Mutating a
 * property in the object will set that variable in the environment for
 * the process. The environment object will only accept `string`s
 * as values.
 *
 *       const myEnv = Deno.env();
 *       console.log(myEnv.SHELL);
 *       myEnv.TEST_VAR = "HELLO";
 *       const newEnv = Deno.env();
 *       console.log(myEnv.TEST_VAR == newEnv.TEST_VAR);
 */
export function env(): {
  [index: string]: string;
};
/** Returns the value of an environment variable at invocation.
 * If the variable is not present, `undefined` will be returned.
 *
 *       const myEnv = Deno.env();
 *       console.log(myEnv.SHELL);
 *       myEnv.TEST_VAR = "HELLO";
 *       const newEnv = Deno.env();
 *       console.log(myEnv.TEST_VAR == newEnv.TEST_VAR);
 */
export function env(key: string): string | undefined;
export function env(key?: string) {
  if (key != null) {
    return process.env[key];
  }
  return process.env;
}

/**
 * Returns the current user's home directory.
 * Requires the `--allow-env` flag.
 */
export function homeDir(): string {
  return os.homedir();
}

/**
 * Returns the path to the current deno executable.
 * Requires the `--allow-env` flag.
 */
export function execPath(): string {
  return process.execPath;
}

// @url js/dir.d.ts

/**
 * `cwd()` Return a string representing the current working directory.
 * If the current directory can be reached via multiple paths
 * (due to symbolic links), `cwd()` may return
 * any one of them.
 * throws `NotFound` exception if directory not available
 */
export function cwd(): string {
  return process.cwd();
}

/**
 * `chdir()` Change the current working directory to path.
 * throws `NotFound` exception if directory not available
 */
export function chdir(directory: string): void {
  process.chdir(directory);
}

// @url js/io.d.ts

export const EOF = null;

/** Copies from `src` to `dst` until either `EOF` is reached on `src`
 * or an error occurs. It returns the number of bytes copied and the first
 * error encountered while copying, if any.
 *
 * Because `copy()` is defined to read from `src` until `EOF`, it does not
 * treat an `EOF` from `read()` as an error to be reported.
 */
export async function copy(
  dst: Deno.Writer,
  src: Deno.Reader
): Promise<number> {
  const buf = new Uint8Array(2048);
  let result: Deno.EOF | number;
  let total = 0;
  while ((result = await src.read(buf)) !== Deno.EOF) {
    if (result === buf.byteLength) {
      await dst.write(buf);
    } else {
      await dst.write(buf.subarray(0, result));
    }
    total += result;
  }
  return total;
}

/** Turns `r` into async iterator.
 *
 *      for await (const chunk of toAsyncIterator(reader)) {
 *          console.log(chunk)
 *      }
 */
export async function* toAsyncIterator(
  r: Deno.Reader
): AsyncIterableIterator<Uint8Array> {
  let result: Deno.EOF | number;
  const buf = new Uint8Array(2048);
  while ((result = await r.read(buf)) !== Deno.EOF) {
    if (result === buf.byteLength) {
      yield buf;
    } else {
      yield buf.subarray(0, result);
    }
  }
}

const writeAsync = promisify(fs.write);
const readAsync = promisify(fs.read);
const fstatAsync = promisify(fs.fstat);

class DenoFile
  implements
    Deno.Reader,
    Deno.SyncReader,
    Deno.Writer,
    Deno.SyncWriter,
    Deno.Seeker,
    Deno.SyncSeeker,
    Deno.Closer {
  private loc = 0;

  constructor(readonly fd: number, readonly rid: number) {}

  write(p: Uint8Array): Promise<number> {
    return writeAsync(this.fd, p, 0, p.byteLength, this.loc);
  }

  writeSync(p: Uint8Array): number {
    return fs.writeSync(this.fd, p);
  }

  async read(p: Uint8Array): Promise<number | Deno.EOF> {
    const r = readAsync(this.fd, p, 0, p.byteLength, this.loc);
    return r === 0 ? EOF : r;
  }

  readSync(p: Uint8Array): number | Deno.EOF {
    const result = fs.readSync(this.fd, p, 0, p.byteLength, this.loc);
    this.loc += result;
    if (result === 0) {
      return EOF;
    } else {
      return result;
    }
  }

  async seek(offset: number, whence: Deno.SeekMode): Promise<void> {
    if (whence === Deno.SeekMode.SEEK_START) {
      this.loc = offset;
    } else if (whence === Deno.SeekMode.SEEK_CURRENT) {
      this.loc += offset;
    } else if (whence === Deno.SeekMode.SEEK_END) {
      const stats = await fstatAsync(this.fd);
      this.loc = stats.size - offset;
    }
  }

  seekSync(offset: number, whence: Deno.SeekMode): void {
    if (whence === Deno.SeekMode.SEEK_START) {
      this.loc = offset;
    } else if (whence === Deno.SeekMode.SEEK_CURRENT) {
      this.loc += offset;
    } else if (whence === Deno.SeekMode.SEEK_END) {
      const stats = fs.fstatSync(this.fd);
      this.loc = stats.size - offset;
    }
  }

  close(): void {
    try {
      fs.closeSync(this.fd);
    } finally {
      files.delete(this.rid);
    }
  }
}

export { DenoFile as File };

// @url js/files.d.ts

const files: Map<number, Deno.File> = new Map();
const processes: Map<number, Deno.Process> = new Map();
const conns: Map<number, Deno.Conn> = new Map();
let resourceId = 3;

/** Open a file and return an instance of the `File` object
 *  synchronously.
 *
 *       const file = Deno.openSync("/foo/bar.txt");
 */
export function openSync(filename: string, mode?: Deno.OpenMode): Deno.File {
  const fd = fs.openSync(filename, mode);
  const rid = resourceId++;
  const f = new DenoFile(fd, rid);
  files.set(rid, f);
  return f;
}

/** Open a file and return an instance of the `File` object.
 *
 *       (async () => {
 *         const file = await Deno.open("/foo/bar.txt");
 *       })();
 */
export function open(
  filename: string,
  mode?: Deno.OpenMode
): Promise<Deno.File> {
  return new Promise<Deno.File>((resolve, reject) => {
    fs.open(filename, mode, (err, fd) => {
      if (err) {
        reject(err);
      } else {
        const rid = resourceId++;
        const f = new DenoFile(fd, rid);
        files.set(rid, f);
        return f;
      }
    });
  });
}

/** Read synchronously from a file ID into an array buffer.
 *
 * Return `number | EOF` for the operation.
 *
 *      const file = Deno.openSync("/foo/bar.txt");
 *      const buf = new Uint8Array(100);
 *      const nread = Deno.readSync(file.rid, buf);
 *      const text = new TextDecoder().decode(buf);
 *
 */
export function readSync(rid: number, p: Uint8Array): number | Deno.EOF {
  const file = files.get(rid);
  return file.readSync(p);
}

/** Read from a file ID into an array buffer.
 *
 * Resolves with the `number | EOF` for the operation.
 *
 *       (async () => {
 *         const file = await Deno.open("/foo/bar.txt");
 *         const buf = new Uint8Array(100);
 *         const nread = await Deno.read(file.rid, buf);
 *         const text = new TextDecoder().decode(buf);
 *       })();
 */
export function read(rid: number, p: Uint8Array): Promise<number | Deno.EOF> {
  const file = files.get(rid);
  return file.read(p);
}

/** Write synchronously to the file ID the contents of the array buffer.
 *
 * Resolves with the number of bytes written.
 *
 *       const encoder = new TextEncoder();
 *       const data = encoder.encode("Hello world\n");
 *       const file = Deno.openSync("/foo/bar.txt");
 *       Deno.writeSync(file.rid, data);
 */
export function writeSync(rid: number, p: Uint8Array): number {
  const file = files.get(rid);
  return file.writeSync(p);
}

/** Write to the file ID the contents of the array buffer.
 *
 * Resolves with the number of bytes written.
 *
 *      (async () => {
 *        const encoder = new TextEncoder();
 *        const data = encoder.encode("Hello world\n");
 *        const file = await Deno.open("/foo/bar.txt");
 *        await Deno.write(file.rid, data);
 *      })();
 *
 */
export function write(rid: number, p: Uint8Array): Promise<number> {
  const file = files.get(rid);
  return file.write(p);
}

/** Seek a file ID synchronously to the given offset under mode given by `whence`.
 *
 *       const file = Deno.openSync("/foo/bar.txt");
 *       Deno.seekSync(file.rid, 0, 0);
 */
export function seekSync(
  rid: number,
  offset: number,
  whence: Deno.SeekMode
): void {
  const file = files.get(rid);
  return file.seekSync(offset, whence);
}

/** Seek a file ID to the given offset under mode given by `whence`.
 *
 *      (async () => {
 *        const file = await Deno.open("/foo/bar.txt");
 *        await Deno.seek(file.rid, 0, 0);
 *      })();
 */
export function seek(
  rid: number,
  offset: number,
  whence: Deno.SeekMode
): Promise<void> {
  const file = files.get(rid);
  return file.seek(offset, whence);
}

/** Close the file ID. */
export function close(rid: number): void {
  if (files.has(rid)) {
    const file = files.get(rid);
    try {
      file.close();
    } finally {
      files.delete(rid);
    }
  } else if (processes.has(rid)) {
    const proc = processes.get(rid);
    try {
      proc.close();
    } finally {
      processes.delete(rid);
    }
  } else if (conns.has(rid)) {
    const conn = conns.get(rid);
    try {
      conn.close();
    } finally {
      processes.delete(rid);
    }
  }
}

/** An instance of `File` for stdin. */
export const stdin: Deno.File = new DenoFile(0, 0);
/** An instance of `File` for stdout. */
export const stdout: Deno.File = new DenoFile(1, 1);
/** An instance of `File` for stderr. */
export const stderr: Deno.File = new DenoFile(2, 2);

// @url js/buffer.d.ts

/** A Buffer is a variable-sized buffer of bytes with read() and write()
 * methods. Based on https://golang.org/pkg/bytes/#Buffer
 */
class DenoBuffer
  implements Deno.Reader, Deno.SyncReader, Deno.Writer, Deno.SyncWriter {
  private buf: Buffer;
  private off: number = 0;

  constructor(ab?: ArrayBuffer) {
    this.buf = Buffer.from(ab);
  }

  /** bytes() returns a slice holding the unread portion of the buffer.
   * The slice is valid for use only until the next buffer modification (that
   * is, only until the next call to a method like read(), write(), reset(), or
   * truncate()). The slice aliases the buffer content at least until the next
   * buffer modification, so immediate changes to the slice will affect the
   * result of future reads.
   */
  bytes(): Uint8Array {
    return this.buf;
  }

  /** toString() returns the contents of the unread portion of the buffer
   * as a string. Warning - if multibyte characters are present when data is
   * flowing through the buffer, this method may result in incorrect strings
   * due to a character being split.
   */
  toString(): string {
    return this.buf.toString();
  }

  /** empty() returns whether the unread portion of the buffer is empty. */
  empty(): boolean {
    return this.off === 0 && this.buf.byteLength === 0;
  }

  /** length is a getter that returns the number of bytes of the unread
   * portion of the buffer
   */
  get length(): number {
    return this.buf.byteLength - this.off;
  }

  /** Returns the capacity of the buffer's underlying byte slice, that is,
   * the total space allocated for the buffer's data.
   */
  get capacity(): number {
    return this.buf.byteLength;
  }

  /** truncate() discards all but the first n unread bytes from the buffer but
   * continues to use the same allocated storage.  It throws if n is negative or
   * greater than the length of the buffer.
   */
  truncate(n: number): void {
    for (let i = n; i < this.buf.length; i++) {
      this.buf[i] = 0;
    }
  }

  /** reset() resets the buffer to be empty, but it retains the underlying
   * storage for use by future writes. reset() is the same as truncate(0)
   */
  reset(): void {
    this.buf = new Buffer(new Uint8Array(this.buf.byteLength));
  }

  /** _tryGrowByReslice() is a version of grow for the fast-case
   * where the internal buffer only needs to be resliced. It returns the index
   * where bytes should be written and whether it succeeded.
   * It returns -1 if a reslice was not needed.
   */
  private _tryGrowByReslice;
  private _reslice;

  /** readSync() reads the next len(p) bytes from the buffer or until the buffer
   * is drained. The return value n is the number of bytes read. If the
   * buffer has no data to return, eof in the response will be true.
   */
  readSync(p: Uint8Array): number | Deno.EOF {
    if (this.off === this.buf.byteLength) {
      return EOF;
    }
    const rem = this.buf.byteLength - this.off;
    let end = p.byteLength > rem ? p.byteLength : rem;
    for (let i = 0; i < end; i++) {
      p[i] = this.buf[this.off + i];
    }
    this.off += end;
    return end;
  }

  async read(p: Uint8Array): Promise<number | Deno.EOF> {
    return this.readSync(p);
  }

  writeSync(p: Uint8Array): number {
    const rem = this.buf.byteLength - this.off;
    let end = p.byteLength > rem ? p.byteLength : rem;
    for (let i = 0; i < end; i++) {
      this.buf[this.off + i] = p[i];
    }
    this.off += end;
    return end;
  }

  async write(p: Uint8Array): Promise<number> {
    return this.writeSync(p);
  }

  /** _grow() grows the buffer to guarantee space for n more bytes.
   * It returns the index where bytes should be written.
   * If the buffer can't grow it will throw with ErrTooLarge.
   */
  private _grow;

  /** grow() grows the buffer's capacity, if necessary, to guarantee space for
   * another n bytes. After grow(n), at least n bytes can be written to the
   * buffer without another allocation. If n is negative, grow() will panic. If
   * the buffer can't grow it will throw ErrTooLarge.
   * Based on https://golang.org/pkg/bytes/#Buffer.Grow
   */
  grow(n: number): void {
    const next = new Buffer(this.buf.byteLength + n);
    next.set(this.buf, 0);
    this.buf = next;
  }

  /** readFrom() reads data from r until EOF and appends it to the buffer,
   * growing the buffer as needed. It returns the number of bytes read. If the
   * buffer becomes too large, readFrom will panic with ErrTooLarge.
   * Based on https://golang.org/pkg/bytes/#Buffer.ReadFrom
   */
  readFrom(r: Deno.Reader): Promise<number> {
    return copy(this, r);
  }

  /** Sync version of `readFrom`
   */
  readFromSync(r: Deno.SyncReader): number {
    let result: number | Deno.EOF;
    const buf = new Uint8Array(2048);
    let total = 0;
    while ((result = r.readSync(buf)) !== Deno.EOF) {
      for (let i = 0; i < result; i++) {
        this.buf[this.off + i] = buf[i];
      }
      this.off += result;
      total += result;
    }
    return total;
  }
}

export { DenoBuffer as Buffer };

/** Read `r` until EOF and return the content as `Uint8Array`.
 */
export async function readAll(r: Deno.Reader): Promise<Uint8Array> {
  let chunks: Uint8Array[] = [];
  for await (const chunk of toAsyncIterator(r)) {
    chunks.push(chunk);
  }
  return concatBytes(...chunks);
}

/** Read synchronously `r` until EOF and return the content as `Uint8Array`.
 */
export function readAllSync(r: Deno.SyncReader): Uint8Array {
  let result: number | Deno.EOF;
  let buf = new Uint8Array(2048);
  const chunks: Uint8Array[] = [];
  while ((result = r.readSync(buf)) !== EOF) {
    chunks.push(buf);
    buf = new Uint8Array(2048);
  }
  return concatBytes(...chunks);
}

/** Write all the content of `arr` to `w`.
 */
export async function writeAll(w: Deno.Writer, arr: Uint8Array): Promise<void> {
  let offs = 0;
  const bufSize = 2048;
  offs += await w.write(arr);
  while (offs < arr.byteLength) {
    const remaining = arr.byteLength - offs;
    let end = remaining > bufSize ? bufSize : remaining;
    const written = await w.write(arr.subarray(offs, end));
    offs += written;
  }
}

/** Write synchronously all the content of `arr` to `w`.
 */
export function writeAllSync(w: Deno.SyncWriter, arr: Uint8Array): void {
  let offs = 0;
  const bufSize = 2048;
  offs += w.writeSync(arr);
  while (offs < arr.byteLength) {
    const remaining = arr.byteLength - offs;
    let end = remaining > bufSize ? bufSize : remaining;
    const written = w.writeSync(arr.subarray(offs, end));
    offs += written;
  }
}

// @url js/mkdir.d.ts

/** Creates a new directory with the specified path synchronously.
 * If `recursive` is set to true, nested directories will be created (also known
 * as "mkdir -p").
 * `mode` sets permission bits (before umask) on UNIX and does nothing on
 * Windows.
 *
 *       Deno.mkdirSync("new_dir");
 *       Deno.mkdirSync("nested/directories", true);
 */
export function mkdirSync(
  path: string,
  recursive?: boolean,
  mode?: number
): void {
  fs.mkdirSync(path, { recursive, mode });
}

/** Creates a new directory with the specified path.
 * If `recursive` is set to true, nested directories will be created (also known
 * as "mkdir -p").
 * `mode` sets permission bits (before umask) on UNIX and does nothing on
 * Windows.
 *
 *       await Deno.mkdir("new_dir");
 *       await Deno.mkdir("nested/directories", true);
 */
export function mkdir(
  path: string,
  recursive?: boolean,
  mode?: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.mkdir(path, { mode, recursive }, err => {
      err ? reject(err) : resolve();
    });
  });
}

/** makeTempDirSync is the synchronous version of `makeTempDir`.
 *
 *       const tempDirName0 = Deno.makeTempDirSync();
 *       const tempDirName1 = Deno.makeTempDirSync({ prefix: 'my_temp' });
 */
export function makeTempDirSync(options?: Deno.MakeTempDirOptions): string {
  if (!options) {
    return fs.mkdtempSync("");
  } else {
    let dir = options.dir || os.tmpdir();
    const prefix = options.prefix || "";
    const suffix = options.suffix || "";
    while (true) {
      const rand = Math.random() * 100000;
      const ret = path.join(dir, `${prefix}${rand}${suffix}`);
      if (!fs.existsSync(ret)) {
        mkdirSync(ret);
        return ret;
      }
    }
  }
}

/** makeTempDir creates a new temporary directory in the directory `dir`, its
 * name beginning with `prefix` and ending with `suffix`.
 * It returns the full path to the newly created directory.
 * If `dir` is unspecified, tempDir uses the default directory for temporary
 * files. Multiple programs calling tempDir simultaneously will not choose the
 * same directory. It is the caller's responsibility to remove the directory
 * when no longer needed.
 *
 *       const tempDirName0 = await Deno.makeTempDir();
 *       const tempDirName1 = await Deno.makeTempDir({ prefix: 'my_temp' });
 */
export async function makeTempDir(
  options?: Deno.MakeTempDirOptions
): Promise<string> {
  const mkdtempAsync = promisify(fs.mkdtemp);
  const existsAsync = promisify(fs.exists);
  if (!options) {
    return mkdtempAsync("");
  } else {
    let dir = options.dir || os.tmpdir();
    const prefix = options.prefix || "";
    const suffix = options.suffix || "";
    while (true) {
      const rand = Math.random() * 100000;
      const ret = path.join(dir, `${prefix}${rand}${suffix}`);
      if (!(await existsAsync(ret))) {
        await mkdir(ret, true);
        return ret;
      }
    }
  }
}

// @url js/chmod.d.ts

/** Changes the permission of a specific file/directory of specified path
 * synchronously.
 *
 *       Deno.chmodSync("/path/to/file", 0o666);
 */
export function chmodSync(path: string, mode: number): void {
  fs.chmodSync(path, mode);
}

/** Changes the permission of a specific file/directory of specified path.
 *
 *       await Deno.chmod("/path/to/file", 0o666);
 */
export function chmod(path: string, mode: number): Promise<void> {
  return promisify(fs.chmod)(path, mode);
}

// @url js/chown.d.ts

/**
 * Change owner of a regular file or directory synchronously. Unix only at the moment.
 * @param path path to the file
 * @param uid user id of the new owner
 * @param gid group id of the new owner
 */
export function chownSync(path: string, uid: number, gid: number): void {
  fs.chownSync(path, uid, gid);
}

/**
 * Change owner of a regular file or directory asynchronously. Unix only at the moment.
 * @param path path to the file
 * @param uid user id of the new owner
 * @param gid group id of the new owner
 */
export function chown(path: string, uid: number, gid: number): Promise<void> {
  return promisify(fs.chmod)(path, uid, gid);
}

// @url js/utime.d.ts

/** Synchronously changes the access and modification times of a file system
 * object referenced by `filename`. Given times are either in seconds
 * (Unix epoch time) or as `Date` objects.
 *
 *       Deno.utimeSync("myfile.txt", 1556495550, new Date());
 */
export function utimeSync(
  filename: string,
  atime: number | Date,
  mtime: number | Date
): void {
  fs.utimesSync(filename, atime, mtime);
}

/** Changes the access and modification times of a file system object
 * referenced by `filename`. Given times are either in seconds
 * (Unix epoch time) or as `Date` objects.
 *
 *       await Deno.utime("myfile.txt", 1556495550, new Date());
 */
export function utime(
  filename: string,
  atime: number | Date,
  mtime: number | Date
): Promise<void> {
  return promisify(fs.utime)(filename, atime, mtime);
}

/** Removes the named file or directory synchronously. Would throw
 * error if permission denied, not found, or directory not empty if `recursive`
 * set to false.
 * `recursive` is set to false by default.
 *
 *       Deno.removeSync("/path/to/dir/or/file", {recursive: false});
 */
export function removeSync(path: string, options?: Deno.RemoveOption): void {
  // TODO: recursive
  const stats = fs.statSync(path);
  if (stats.isDirectory()) {
    fs.rmdirSync(path, { recursive: options.recursive });
  } else {
    // TODO: recursive
    fs.unlinkSync(path);
  }
}

/** Removes the named file or directory. Would throw error if
 * permission denied, not found, or directory not empty if `recursive` set
 * to false.
 * `recursive` is set to false by default.
 *
 *       await Deno.remove("/path/to/dir/or/file", {recursive: false});
 */
export async function remove(
  path: string,
  options?: Deno.RemoveOption
): Promise<void> {
  const statAsync = promisify(fs.stat);
  const rmdirAsync = promisify(fs.rmdir);
  const unlinkAasync = promisify(fs.unlink);
  const stats = await statAsync(path);
  if (stats.isDirectory()) {
    await rmdirAsync(path, options);
  } else {
    // TODO: recursive
    await unlinkAasync(path);
  }
}

// @url js/rename.d.ts

/** Synchronously renames (moves) `oldpath` to `newpath`. If `newpath` already
 * exists and is not a directory, `renameSync()` replaces it. OS-specific
 * restrictions may apply when `oldpath` and `newpath` are in different
 * directories.
 *
 *       Deno.renameSync("old/path", "new/path");
 */
export function renameSync(oldpath: string, newpath: string): void {
  fs.renameSync(oldpath, newpath);
}

/** Renames (moves) `oldpath` to `newpath`. If `newpath` already exists and is
 * not a directory, `rename()` replaces it. OS-specific restrictions may apply
 * when `oldpath` and `newpath` are in different directories.
 *
 *       await Deno.rename("old/path", "new/path");
 */
export function rename(oldpath: string, newpath: string): Promise<void> {
  const renameAsync = promisify(fs.rename);
  return renameAsync(oldpath, newpath);
}

// @url js/read_file.d.ts

/** Read the entire contents of a file synchronously.
 *
 *       const decoder = new TextDecoder("utf-8");
 *       const data = Deno.readFileSync("hello.txt");
 *       console.log(decoder.decode(data));
 */
export function readFileSync(filename: string): Uint8Array {
  return fs.readFileSync(filename).bytes();
}

/** Read the entire contents of a file.
 *
 *       const decoder = new TextDecoder("utf-8");
 *       const data = await Deno.readFile("hello.txt");
 *       console.log(decoder.decode(data));
 */
export async function readFile(filename: string): Promise<Uint8Array> {
  const readFileAsync = promisify(fs.readFile);
  const buf = await readFileAsync(filename);
  return buf.bytes();
}

// @url js/read_dir.d.ts

/** Reads the directory given by path and returns a list of file info
 * synchronously.
 *
 *       const files = Deno.readDirSync("/");
 */
export function readDirSync(path: string): Deno.FileInfo[] {
  return fs.readdirSync(path).map(statSync);
}

/** Reads the directory given by path and returns a list of file info.
 *
 *       const files = await Deno.readDir("/");
 */
export async function readDir(path: string): Promise<Deno.FileInfo[]> {
  const readDirAsync = promisify(fs.readdir);
  const arr = await readDirAsync(path);
  return Promise.all(arr.map(stat));
}

// @url js/copy_file.d.ts

/** Copies the contents of a file to another by name synchronously.
 * Creates a new file if target does not exists, and if target exists,
 * overwrites original content of the target file.
 *
 * It would also copy the permission of the original file
 * to the destination.
 *
 *       Deno.copyFileSync("from.txt", "to.txt");
 */
export function copyFileSync(from: string, to: string): void {
  fs.copyFileSync(from, to);
}

/** Copies the contents of a file to another by name.
 *
 * Creates a new file if target does not exists, and if target exists,
 * overwrites original content of the target file.
 *
 * It would also copy the permission of the original file
 * to the destination.
 *
 *       await Deno.copyFile("from.txt", "to.txt");
 */
export function copyFile(from: string, to: string): Promise<void> {
  const copyFileAsync = promisify(fs.copyFile);
  return copyFileAsync(from, to);
}

// @url js/read_link.d.ts

/** Returns the destination of the named symbolic link synchronously.
 *
 *       const targetPath = Deno.readlinkSync("symlink/path");
 */
export function readlinkSync(name: string): string {
  return fs.readlinkSync(name);
}

/** Returns the destination of the named symbolic link.
 *
 *       const targetPath = await Deno.readlink("symlink/path");
 */
export function readlink(name: string): Promise<string> {
  const readlinkAsync = promisify(fs.readlink);
  return readlinkAsync(name);
}

function statToFileInfo(filename: string, stats: Stats): Deno.FileInfo {
  return {
    accessed: stats.atimeMs,
    created: stats.ctimeMs,
    len: stats.size,
    mode: stats.mode,
    modified: stats.mtimeMs,
    name: filename, // basename?
    isDirectory(): boolean {
      return stats.isDirectory();
    },
    isFile(): boolean {
      return stats.isFile();
    },
    isSymlink(): boolean {
      return stats.isSymbolicLink();
    }
  };
}

/** Queries the file system for information on the path provided. If the given
 * path is a symlink information about the symlink will be returned.
 *
 *       const fileInfo = await Deno.lstat("hello.txt");
 *       assert(fileInfo.isFile());
 */
export async function lstat(filename: string): Promise<Deno.FileInfo> {
  const lstatAsync = promisify(fs.lstat);
  const stats = await lstatAsync(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided synchronously.
 * If the given path is a symlink information about the symlink will be
 * returned.
 *
 *       const fileInfo = Deno.lstatSync("hello.txt");
 *       assert(fileInfo.isFile());
 */
export function lstatSync(filename: string): Deno.FileInfo {
  const stats = fs.lstatSync(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided. `stat` Will
 * always follow symlinks.
 *
 *       const fileInfo = await Deno.stat("hello.txt");
 *       assert(fileInfo.isFile());
 */
export async function stat(filename: string): Promise<Deno.FileInfo> {
  const statAsync = promisify(fs.stat);
  const stats = await statAsync(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided synchronously.
 * `statSync` Will always follow symlinks.
 *
 *       const fileInfo = Deno.statSync("hello.txt");
 *       assert(fileInfo.isFile());
 */
export function statSync(filename: string): Deno.FileInfo {
  const stats = fs.statSync(filename);
  return statToFileInfo(filename, stats);
}

// @url js/link.d.ts

/** Synchronously creates `newname` as a hard link to `oldname`.
 *
 *       Deno.linkSync("old/name", "new/name");
 */
export function linkSync(oldname: string, newname: string): void {
  fs.linkSync(oldname, newname);
}

/** Creates `newname` as a hard link to `oldname`.
 *
 *       await Deno.link("old/name", "new/name");
 */
export function link(oldname: string, newname: string): Promise<void> {
  const linkAsync = promisify(fs.link);
  return linkAsync(oldname, newname);
}

// @url js/symlink.d.ts

/** Synchronously creates `newname` as a symbolic link to `oldname`. The type
 * argument can be set to `dir` or `file` and is only available on Windows
 * (ignored on other platforms).
 *
 *       Deno.symlinkSync("old/name", "new/name");
 */
export function symlinkSync(
  oldname: string,
  newname: string,
  type?: "dir" | "file"
): void {
  fs.symlinkSync(oldname, newname, type);
}

/** Creates `newname` as a symbolic link to `oldname`. The type argument can be
 * set to `dir` or `file` and is only available on Windows (ignored on other
 * platforms).
 *
 *       await Deno.symlink("old/name", "new/name");
 */
export function symlink(
  oldname: string,
  newname: string,
  type?: "file" | "dir"
): Promise<void> {
  const symlinkAsync = promisify(fs.symlink);
  return symlinkAsync(oldname, newname, type);
}

// @url js/write_file.d.ts

/** Options for writing to a file.
 * `perm` would change the file's permission if set.
 * `create` decides if the file should be created if not exists (default: true)
 * `append` decides if the file should be appended (default: false)
 */
export interface WriteFileOptions {
  perm?: number;
  create?: boolean;
  append?: boolean;
}

/** Write a new file, with given filename and data synchronously.
 *
 *       const encoder = new TextEncoder();
 *       const data = encoder.encode("Hello world\n");
 *       Deno.writeFileSync("hello.txt", data);
 */
export function writeFileSync(
  filename: string,
  data: Uint8Array,
  options: WriteFileOptions = {
    create: true,
    append: false
  }
): void {
  let flag = "w";
  if (options.create != null) {
    flag = options.create ? "w" : "wx";
  }
  if (options.append != null) {
    flag = options.append ? "a" : "ax";
  }
  fs.writeFileSync(filename, data, {
    flag,
    mode: options.perm
  });
}

/** Write a new file, with given filename and data.
 *
 *       const encoder = new TextEncoder();
 *       const data = encoder.encode("Hello world\n");
 *       await Deno.writeFile("hello.txt", data);
 */
export function writeFile(
  filename: string,
  data: Uint8Array,
  options?: WriteFileOptions
): Promise<void> {
  let flag = "w";
  const writeAsync = promisify(fs.write);
  if (options.create != null) {
    flag = options.create ? "w" : "wx";
  }
  if (options.append != null) {
    flag = options.append ? "a" : "ax";
  }
  return writeAsync(filename, data, {
    flag,
    mode: options.perm
  });
}

// @url js/error_stack.d.ts

interface Location {
  /** The full url for the module, e.g. `file://some/file.ts` or
   * `https://some/file.ts`. */
  filename: string;
  /** The line number in the file.  It is assumed to be 1-indexed. */
  line: number;
  /** The column number in the file.  It is assumed to be 1-indexed. */
  column: number;
}

/** Given a current location in a module, lookup the source location and
 * return it.
 *
 * When Deno transpiles code, it keep source maps of the transpiled code.  This
 * function can be used to lookup the original location.  This is automatically
 * done when accessing the `.stack` of an error, or when an uncaught error is
 * logged.  This function can be used to perform the lookup for creating better
 * error handling.
 *
 * **Note:** `line` and `column` are 1 indexed, which matches display
 * expectations, but is not typical of most index numbers in Deno.
 *
 * An example:
 *
 *       const orig = Deno.applySourceMap({
 *         location: "file://my/module.ts",
 *         line: 5,
 *         column: 15
 *       });
 *       console.log(`${orig.filename}:${orig.line}:${orig.column}`);
 *
 */
export function applySourceMap(location: Location): Location {
  throw new Error("unsupported");
}

// @url js/errors.d.ts

/** A Deno specific error.  The `kind` property is set to a specific error code
 * which can be used to in application logic.
 *
 *       try {
 *         somethingThatMightThrow();
 *       } catch (e) {
 *         if (
 *           e instanceof Deno.DenoError &&
 *           e.kind === Deno.ErrorKind.Overflow
 *         ) {
 *           console.error("Overflow error!");
 *         }
 *       }
 *
 */
export class DenoError<T extends Deno.ErrorKind> extends Error {
  readonly kind: T;

  constructor(kind: T, msg: string) {
    super(msg);
    this.kind = kind;
  }
}

interface RunPermissionDescriptor {
  name: "run";
}

interface ReadWritePermissionDescriptor {
  name: "read" | "write";
  path?: string;
}

interface NetPermissionDescriptor {
  name: "net";
  url?: string;
}

interface EnvPermissionDescriptor {
  name: "env";
}

interface HrtimePermissionDescriptor {
  name: "hrtime";
}

/** See: https://w3c.github.io/permissions/#permission-descriptor */
type PermissionDescriptor =
  | RunPermissionDescriptor
  | ReadWritePermissionDescriptor
  | NetPermissionDescriptor
  | EnvPermissionDescriptor
  | HrtimePermissionDescriptor;

export class Permissions {
  /** Queries the permission.
   *       const status = await Deno.permissions.query({ name: "read", path: "/etc" });
   *       if (status.state === "granted") {
   *         data = await Deno.readFile("/etc/passwd");
   *       }
   */
  async query(d: PermissionDescriptor): Promise<PermissionStatus> {
    return new PermissionStatus("granted");
  }

  /** Revokes the permission.
   *       const status = await Deno.permissions.revoke({ name: "run" });
   *       assert(status.state !== "granted")
   */
  async revoke(d: PermissionDescriptor): Promise<PermissionStatus> {
    return new PermissionStatus("granted");
  }
}

export const permissions: Permissions = new Permissions();

/** https://w3c.github.io/permissions/#permissionstatus */
export class PermissionStatus {
  state: Deno.PermissionState;

  constructor(state: Deno.PermissionState) {
    this.state = state;
  }
}

// @url js/truncate.d.ts

/** Truncates or extends the specified file synchronously, updating the size of
 * this file to become size.
 *
 *       Deno.truncateSync("hello.txt", 10);
 */
export function truncateSync(name: string, len?: number): void {
  fs.truncateSync(name, len);
}

/**
 * Truncates or extends the specified file, updating the size of this file to
 * become size.
 *
 *       await Deno.truncate("hello.txt", 10);
 */
export function truncate(name: string, len?: number): Promise<void> {
  const truncateAsync = promisify(fs.truncate);
  return truncateAsync(name, len);
}

/** Listen announces on the local transport address.
 *
 * @param options
 * @param options.port The port to connect to. (Required.)
 * @param options.hostname A literal IP address or host name that can be
 *   resolved to an IP address. If not specified, defaults to 0.0.0.0
 * @param options.transport Defaults to "tcp". Later we plan to add "tcp4",
 *   "tcp6", "udp", "udp4", "udp6", "ip", "ip4", "ip6", "unix", "unixgram" and
 *   "unixpacket".
 *
 * Examples:
 *
 *     listen({ port: 80 })
 *     listen({ hostname: "192.0.2.1", port: 80 })
 *     listen({ hostname: "[2001:db8::1]", port: 80 });
 *     listen({ hostname: "golang.org", port: 80, transport: "tcp" })
 */
export function listen(options: Deno.ListenOptions): Deno.Listener {
  // TODO
  throw new Error("unsupported");
}

/** Listen announces on the local transport address over TLS (transport layer security).
 *
 * @param options
 * @param options.port The port to connect to. (Required.)
 * @param options.hostname A literal IP address or host name that can be
 *   resolved to an IP address. If not specified, defaults to 0.0.0.0
 * @param options.certFile Server certificate file
 * @param options.keyFile Server public key file
 *
 * Examples:
 *
 *     Deno.listenTLS({ port: 443, certFile: "./my_server.crt", keyFile: "./my_server.key" })
 */
export function listenTLS(options: Deno.ListenTLSOptions): Deno.Listener {
  throw new Error("unsupported");
}

/** Dial connects to the address on the named transport.
 *
 * @param options
 * @param options.port The port to connect to. (Required.)
 * @param options.hostname A literal IP address or host name that can be
 *   resolved to an IP address. If not specified, defaults to 127.0.0.1
 * @param options.transport Defaults to "tcp". Later we plan to add "tcp4",
 *   "tcp6", "udp", "udp4", "udp6", "ip", "ip4", "ip6", "unix", "unixgram" and
 *   "unixpacket".
 *
 * Examples:
 *
 *     dial({ port: 80 })
 *     dial({ hostname: "192.0.2.1", port: 80 })
 *     dial({ hostname: "[2001:db8::1]", port: 80 });
 *     dial({ hostname: "golang.org", port: 80, transport: "tcp" })
 */
export function dial(options: Deno.DialOptions): Promise<Deno.Conn> {
  throw new Error("unsupported");
}

/**
 * dialTLS establishes a secure connection over TLS (transport layer security).
 */
export function dialTLS(options: Deno.DialTLSOptions): Promise<Deno.Conn> {
  throw new Error("unsupported");
}

/** Receive metrics from the privileged side of Deno.
 *
 *      > console.table(Deno.metrics())
 *      ┌──────────────────┬────────┐
 *      │     (index)      │ Values │
 *      ├──────────────────┼────────┤
 *      │  opsDispatched   │   9    │
 *      │   opsCompleted   │   9    │
 *      │ bytesSentControl │  504   │
 *      │  bytesSentData   │   0    │
 *      │  bytesReceived   │  856   │
 *      └──────────────────┴────────┘
 */
export function metrics(): Deno.Metrics {
  return {
    opsCompleted: 0,
    opsDispatched: 0,
    bytesReceived: 0,
    bytesSentControl: 0,
    bytesSentData: 0
  };
}

// @url js/resources.d.ts

interface ResourceMap {
  [rid: number]: string;
}

/** Returns a map of open _file like_ resource ids along with their string
 * representation.
 */
export function resources(): ResourceMap {
  return Object.fromEntries([
    ...[...files.entries()].map(e => [e[0], "file"]),
    ...[...processes.entries()].map(e => [e[0], "process"]),
    ...[...conns.entries()].map(e => [e[0], "conn"])
  ]);
}

/** Send a signal to process under given PID. Unix only at this moment.
 * If pid is negative, the signal will be sent to the process group identified
 * by -pid.
 * Requires the `--allow-run` flag.
 */
export function kill(pid: number, signo: number): void {
  process.kill(pid, signo);
}

class DenoProcess {
  readonly rid: number;
  readonly pid: number;
  readonly stdin?: Deno.WriteCloser;
  readonly stdout?: Deno.ReadCloser;
  readonly stderr?: Deno.ReadCloser;
  statusDeferred = deferred<Deno.ProcessStatus>();

  constructor(rid: number, readonly proc: ChildProcess) {
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
      const status: Deno.ProcessStatus = { success: false };
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

  status(): Promise<Deno.ProcessStatus> {
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
        this.kill(Signal.SIGKILL);
      }
    } finally {
      processes.delete(this.rid);
    }
  }

  kill(signo: number): void {
    process.kill(this.pid, signo);
  }
}

export {DenoProcess as Process}

/**
 * Spawns new subprocess.
 *
 * Subprocess uses same working directory as parent process unless `opt.cwd`
 * is specified.
 *
 * Environmental variables for subprocess can be specified using `opt.env`
 * mapping.
 *
 * By default subprocess inherits stdio of parent process. To change that
 * `opt.stdout`, `opt.stderr` and `opt.stdin` can be specified independently -
 * they can be set to either `ProcessStdio` or `rid` of open file.
 */
export function run(opt: Deno.RunOptions): Deno.Process {
  const [cmd, ...args] = opt.args;
  const p = cp.spawn(cmd, args, {
    cwd: opt.cwd,
    env: opt.env
  });
  const rid = resourceId++;
  const proc = new DenoProcess(rid, p);
  processes.set(rid, proc);
  return proc;
}

enum LinuxSignal {
  SIGHUP = 1,
  SIGINT = 2,
  SIGQUIT = 3,
  SIGILL = 4,
  SIGTRAP = 5,
  SIGABRT = 6,
  SIGBUS = 7,
  SIGFPE = 8,
  SIGKILL = 9,
  SIGUSR1 = 10,
  SIGSEGV = 11,
  SIGUSR2 = 12,
  SIGPIPE = 13,
  SIGALRM = 14,
  SIGTERM = 15,
  SIGSTKFLT = 16,
  SIGCHLD = 17,
  SIGCONT = 18,
  SIGSTOP = 19,
  SIGTSTP = 20,
  SIGTTIN = 21,
  SIGTTOU = 22,
  SIGURG = 23,
  SIGXCPU = 24,
  SIGXFSZ = 25,
  SIGVTALRM = 26,
  SIGPROF = 27,
  SIGWINCH = 28,
  SIGIO = 29,
  SIGPWR = 30,
  SIGSYS = 31
}

enum MacOSSignal {
  SIGHUP = 1,
  SIGINT = 2,
  SIGQUIT = 3,
  SIGILL = 4,
  SIGTRAP = 5,
  SIGABRT = 6,
  SIGEMT = 7,
  SIGFPE = 8,
  SIGKILL = 9,
  SIGBUS = 10,
  SIGSEGV = 11,
  SIGSYS = 12,
  SIGPIPE = 13,
  SIGALRM = 14,
  SIGTERM = 15,
  SIGURG = 16,
  SIGSTOP = 17,
  SIGTSTP = 18,
  SIGCONT = 19,
  SIGCHLD = 20,
  SIGTTIN = 21,
  SIGTTOU = 22,
  SIGIO = 23,
  SIGXCPU = 24,
  SIGXFSZ = 25,
  SIGVTALRM = 26,
  SIGPROF = 27,
  SIGWINCH = 28,
  SIGINFO = 29,
  SIGUSR1 = 30,
  SIGUSR2 = 31
}

/** Signals numbers. This is platform dependent.
 */
export const Signal: typeof MacOSSignal | typeof LinuxSignal =
  os.platform() === "darwin" ? MacOSSignal : LinuxSignal;
// export {};

// @url js/console.d.ts

type ConsoleOptions = Partial<{
  showHidden: boolean;
  depth: number;
  colors: boolean;
  indentLevel: number;
}>;
/** A symbol which can be used as a key for a custom method which will be called
 * when `Deno.inspect()` is called, or when the object is logged to the console.
 */
export const customInspect: unique symbol = Symbol("customInspect");

/**
 * `inspect()` converts input into string that has the same format
 * as printed by `console.log(...)`;
 */
export function inspect(value: unknown, options?: ConsoleOptions): string {
  return nodeInspect(value, options);
}

/** Build related information */
interface BuildInfo {
  /** The CPU architecture. */
  arch: Deno.Arch;
  /** The operating system. */
  os: Deno.OperatingSystem;
}

export const build: BuildInfo = {
  arch: os.arch(),
  os: os.platform()
};

// @url js/version.d.ts

interface Version {
  deno: string;
  v8: string;
  typescript: string;
}

export const version: Version = {
  deno: "0.23.0",
  v8: "7.9.317.12",
  typescript: "3.6.3"
};

// @url js/deno.d.ts

export const args: string[] = [...process.argv];
