import * as fs from "fs";
import * as util from "util";
import * as os from "os";
import * as path from "path";
import * as cp from "child_process";
import { ResourceTable } from "./resources";
import { DenoFileImpl } from "./file";
import { DenoProcessImpl } from "./process";

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
export const EOF = Symbol("EOF");
export type EOF = typeof EOF;

export enum SeekMode {
  SEEK_START = 0,
  SEEK_CURRENT = 1,
  SEEK_END = 2
}
export interface Reader {
  /** Reads up to p.byteLength bytes into `p`. It resolves to the number
   * of bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error encountered.
   * Even if `read()` returns `n` < `p.byteLength`, it may use all of `p` as
   * scratch space during the call. If some data is available but not
   * `p.byteLength` bytes, `read()` conventionally returns what is available
   * instead of waiting for more.
   *
   * When `read()` encounters end-of-file condition, it returns EOF symbol.
   *
   * When `read()` encounters an error, it rejects with an error.
   *
   * Callers should always process the `n` > `0` bytes returned before
   * considering the EOF. Doing so correctly handles I/O errors that happen
   * after reading some bytes and also both of the allowed EOF behaviors.
   *
   * Implementations must not retain `p`.
   */
  read(p: Uint8Array): Promise<number | EOF>;
}
export interface SyncReader {
  readSync(p: Uint8Array): number | EOF;
}
export interface Writer {
  /** Writes `p.byteLength` bytes from `p` to the underlying data
   * stream. It resolves to the number of bytes written from `p` (`0` <= `n` <=
   * `p.byteLength`) and any error encountered that caused the write to stop
   * early. `write()` must return a non-null error if it returns `n` <
   * `p.byteLength`. write() must not modify the slice data, even temporarily.
   *
   * Implementations must not retain `p`.
   */
  write(p: Uint8Array): Promise<number>;
}
export interface SyncWriter {
  writeSync(p: Uint8Array): number;
}
export interface Closer {
  close(): void;
}
export interface Seeker {
  /** Seek sets the offset for the next `read()` or `write()` to offset,
   * interpreted according to `whence`: `SeekStart` means relative to the start
   * of the file, `SeekCurrent` means relative to the current offset, and
   * `SeekEnd` means relative to the end. Seek returns the new offset relative
   * to the start of the file and an error, if any.
   *
   * Seeking to an offset before the start of the file is an error. Seeking to
   * any positive offset is legal, but the behavior of subsequent I/O operations
   * on the underlying object is implementation-dependent.
   */
  seek(offset: number, whence: SeekMode): Promise<void>;
}
export interface SyncSeeker {
  seekSync(offset: number, whence: SeekMode): void;
}
export interface ReadCloser extends Reader, Closer {}
export interface WriteCloser extends Writer, Closer {}
export interface ReadSeeker extends Reader, Seeker {}
export interface WriteSeeker extends Writer, Seeker {}
export interface ReadWriteCloser extends Reader, Writer, Closer {}
export interface ReadWriteSeeker extends Reader, Writer, Seeker {}

/** Copies from `src` to `dst` until either `EOF` is reached on `src`
 * or an error occurs. It returns the number of bytes copied and the first
 * error encountered while copying, if any.
 *
 * Because `copy()` is defined to read from `src` until `EOF`, it does not
 * treat an `EOF` from `read()` as an error to be reported.
 */
export async function copy(dst: Writer, src: Reader): Promise<number> {
  const buf = new Uint8Array(2048);
  let result: EOF | number;
  let total = 0;
  while ((result = await src.read(buf)) !== EOF) {
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
  r: Reader
): AsyncIterableIterator<Uint8Array> {
  let result: EOF | number;
  const buf = new Uint8Array(2048);
  while ((result = await r.read(buf)) !== EOF) {
    if (result === buf.byteLength) {
      yield buf;
    } else {
      yield buf.subarray(0, result);
    }
  }
}

export interface DenoFile
  extends Reader,
    SyncReader,
    Writer,
    SyncWriter,
    Seeker,
    SyncSeeker,
    Closer {
  readonly rid: number;
}

class DenoStdioImpl implements DenoFile {
  readonly rid = this.fd;
  constructor(readonly fd: 0 | 1 | 2) {}
  close(): void {
    // noop
  }

  offs = 0;
  read(p: Uint8Array): Promise<number | EOF> {
    return new Promise<number | EOF>((resolve, reject) => {
      fs.read(this.fd, p, 0, p.byteLength, this.offs, (err, bytesRead) => {
        if (err) {
          reject(err);
        } else if (bytesRead === 0) {
          resolve(EOF);
        } else {
          this.offs += bytesRead;
          resolve(bytesRead);
        }
      });
    });
  }

  readSync(p: Uint8Array): number | EOF {
    const bytesRead = fs.readSync(this.fd, p, 0, p.byteLength, this.offs);
    this.offs += bytesRead;
    return bytesRead === 0 ? EOF : bytesRead;
  }

  seek(offset: number, whence: SeekMode): Promise<void> {
    throw new Error("stdin/stdout/stderr can't be seeked");
  }

  seekSync(offset: number, whence: SeekMode): void {
    throw new Error("stdin/stdout/stderr can't be seeked");
  }

  write(p: Uint8Array): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      fs.write(this.fd, p, 0, p.byteLength, this.offs, (err, written) => {
        if (err) {
          reject(err);
        } else {
          this.offs += written;
          resolve(written);
        }
      });
    });
  }

  writeSync(p: Uint8Array): number {
    return fs.writeSync(this.fd, p, 0, p.byteLength, this.offs);
  }
}

export { DenoFileImpl as File };

// @url js/files.d.ts

/** Open a file and return an instance of the `File` object
 *  synchronously.
 *
 *       const file = Deno.openSync("/foo/bar.txt");
 */
/** @deprecated */
export function openSync(filename: string, mode?: OpenMode): DenoFile {
  // const file = awaitPromiseSync(fs.promises.open(filename, mode));
  // return ResourceTable.openFile(file);
  throw new Error("openSync is unsupported because of technical reason.");
}

/** Open a file and return an instance of the `File` object.
 *
 *       (async () => {
 *         const file = await Deno.open("/foo/bar.txt");
 *       })();
 */
export async function open(
  filename: string,
  mode?: OpenMode
): Promise<DenoFile> {
  const fileHandle = await fs.promises.open(filename, mode);
  return ResourceTable.openFile(fileHandle);
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
export function readSync(rid: number, p: Uint8Array): number | EOF {
  return ResourceTable.getFile(rid).readSync(p);
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
export function read(rid: number, p: Uint8Array): Promise<number | EOF> {
  return ResourceTable.getFile(rid).read(p);
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
  return ResourceTable.getFile(rid).writeSync(p);
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
  return ResourceTable.getFile(rid).write(p);
}

/** Seek a file ID synchronously to the given offset under mode given by `whence`.
 *
 *       const file = Deno.openSync("/foo/bar.txt");
 *       Deno.seekSync(file.rid, 0, 0);
 */
export function seekSync(rid: number, offset: number, whence: SeekMode): void {
  ResourceTable.getFile(rid).seekSync(offset, whence);
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
  whence: SeekMode
): Promise<void> {
  return ResourceTable.getFile(rid).seek(offset, whence);
}

/** Close the file ID. */
export function close(rid: number): void {
  ResourceTable.close(rid);
}

/** An instance of `File` for stdin. */
export const stdin: DenoFile = new DenoStdioImpl(0);
/** An instance of `File` for stdout. */
export const stdout: DenoFile = new DenoStdioImpl(1);
/** An instance of `File` for stderr. */
export const stderr: DenoFile = new DenoStdioImpl(2);

export type OpenMode =
  | "r"
  /** Read-write. Start at beginning of file. */
  | "r+"
  /** Write-only. Opens and truncates existing file or creates new one for
   * writing only.
   */
  | "w"
  /** Read-write. Opens and truncates existing file or creates new one for
   * writing and reading.
   */
  | "w+"
  /** Write-only. Opens existing file or creates new one. Each write appends
   * content to the end of file.
   */
  | "a"
  /** Read-write. Behaves like "a" and allows to read from file. */
  | "a+"
  /** Write-only. Exclusive create - creates new file only if one doesn't exist
   * already.
   */
  | "x"
  /** Read-write. Behaves like `x` and allows to read from file. */
  | "x+";

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

export interface MakeTempDirOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

/** makeTempDirSync is the synchronous version of `makeTempDir`.
 *
 *       const tempDirName0 = Deno.makeTempDirSync();
 *       const tempDirName1 = Deno.makeTempDirSync({ prefix: 'my_temp' });
 */
export function makeTempDirSync(options?: MakeTempDirOptions): string {
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
  options?: MakeTempDirOptions
): Promise<string> {
  if (!options) {
    return fs.promises.mkdtemp("");
  } else {
    let dir = options.dir || os.tmpdir();
    const prefix = options.prefix || "";
    const suffix = options.suffix || "";
    const day = Date.now();
    const rand = Math.random() * 100000;
    const ret = path.join(dir, `${prefix}${day}-${rand}${suffix}`);
    await mkdir(ret, true);
    return ret;
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
  return fs.promises.chmod(path, mode);
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
  return fs.promises.chown(path, uid, gid);
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
  return fs.promises.utimes(filename, atime, mtime);
}

export interface RemoveOption {
  recursive?: boolean;
}

/** Removes the named file or directory synchronously. Would throw
 * error if permission denied, not found, or directory not empty if `recursive`
 * set to false.
 * `recursive` is set to false by default.
 *
 *       Deno.removeSync("/path/to/dir/or/file", {recursive: false});
 */
export function removeSync(path: string, options?: RemoveOption): void {
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
  options?: RemoveOption
): Promise<void> {
  const stats = await fs.promises.stat(path);
  if (stats.isDirectory()) {
    await fs.promises.rmdir(path, options);
  } else {
    // TODO: recursive
    await fs.promises.unlink(path);
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
  return fs.promises.rename(oldpath, newpath);
}

// @url js/read_file.d.ts

/** Read the entire contents of a file synchronously.
 *
 *       const decoder = new TextDecoder("utf-8");
 *       const data = Deno.readFileSync("hello.txt");
 *       console.log(decoder.decode(data));
 */
export function readFileSync(filename: string): Uint8Array {
  return fs.readFileSync(filename);
}

/** Read the entire contents of a file.
 *
 *       const decoder = new TextDecoder("utf-8");
 *       const data = await Deno.readFile("hello.txt");
 *       console.log(decoder.decode(data));
 */
export async function readFile(filename: string): Promise<Uint8Array> {
  return fs.promises.readFile(filename);
}

/** Synchronously reads and returns the entire contents of a file as utf8 encoded string
 *  encoded string. Reading a directory returns an empty string.
 *
 * ```ts
 * const data = Deno.readTextFileSync("hello.txt");
 * console.log(data);
 * ```
 *
 * Requires `allow-read` permission. */
export function readTextFileSync(path: string): string {
  return fs.readFileSync(path, "utf8");
}

/** Asynchronously reads and returns the entire contents of a file as a utf8
 *  encoded string. Reading a directory returns an empty data array.
 *
 * ```ts
 * const data = await Deno.readTextFile("hello.txt");
 * console.log(data);
 * ```
 *
 * Requires `allow-read` permission. */
export function readTextFile(path: string): Promise<string> {
  return fs.promises.readFile(path, "utf8");
}
export interface FileInfo {
  /** The size of the file, in bytes. */
  len: number;
  /** The last modification time of the file. This corresponds to the `mtime`
   * field from `stat` on Unix and `ftLastWriteTime` on Windows. This may not
   * be available on all platforms.
   */
  modified: number | null;
  /** The last access time of the file. This corresponds to the `atime`
   * field from `stat` on Unix and `ftLastAccessTime` on Windows. This may not
   * be available on all platforms.
   */
  accessed: number | null;
  /** The last access time of the file. This corresponds to the `birthtime`
   * field from `stat` on Unix and `ftCreationTime` on Windows. This may not
   * be available on all platforms.
   */
  created: number | null;
  /** The underlying raw st_mode bits that contain the standard Unix permissions
   * for this file/directory. TODO Match behavior with Go on windows for mode.
   */
  mode: number | null;
  /** The file or directory name. */
  name: string | null;
  /** Returns whether this is info for a regular file. This result is mutually
   * exclusive to `FileInfo.isDirectory` and `FileInfo.isSymlink`.
   */
  isFile(): boolean;
  /** Returns whether this is info for a regular directory. This result is
   * mutually exclusive to `FileInfo.isFile` and `FileInfo.isSymlink`.
   */
  isDirectory(): boolean;
  /** Returns whether this is info for a symlink. This result is
   * mutually exclusive to `FileInfo.isFile` and `FileInfo.isDirectory`.
   */
  isSymlink(): boolean;
}

// @url js/read_dir.d.ts

/** Reads the directory given by path and returns a list of file info
 * synchronously.
 *
 *       const files = Deno.readDirSync("/");
 */
export function readDirSync(path: string): FileInfo[] {
  return fs.readdirSync(path).map(statSync);
}

/** Reads the directory given by path and returns a list of file info.
 *
 *       const files = await Deno.readDir("/");
 */
export async function readDir(path: string): Promise<FileInfo[]> {
  const arr = await fs.promises.readdir(path);
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
  return fs.promises.copyFile(from, to);
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
  return fs.promises.readlink(name);
}

function statToFileInfo(filename: string, stats: fs.Stats): FileInfo {
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
export async function lstat(filename: string): Promise<FileInfo> {
  const stats = await fs.promises.lstat(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided synchronously.
 * If the given path is a symlink information about the symlink will be
 * returned.
 *
 *       const fileInfo = Deno.lstatSync("hello.txt");
 *       assert(fileInfo.isFile());
 */
export function lstatSync(filename: string): FileInfo {
  const stats = fs.lstatSync(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided. `stat` Will
 * always follow symlinks.
 *
 *       const fileInfo = await Deno.stat("hello.txt");
 *       assert(fileInfo.isFile());
 */
export async function stat(filename: string): Promise<FileInfo> {
  const stats = await fs.promises.stat(filename);
  return statToFileInfo(filename, stats);
}

/** Queries the file system for information on the path provided synchronously.
 * `statSync` Will always follow symlinks.
 *
 *       const fileInfo = Deno.statSync("hello.txt");
 *       assert(fileInfo.isFile());
 */
export function statSync(filename: string): FileInfo {
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
  return fs.promises.link(oldname, newname);
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
  return fs.promises.symlink(oldname, newname, type);
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
  if (options?.create != null) {
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
  options: WriteFileOptions = {
    create: true,
    append: false
  }
): Promise<void> {
  let flag = "w";
  if (options.create != null) {
    flag = options.create ? "w" : "wx";
  }
  if (options.append != null) {
    flag = options.append ? "a" : "ax";
  }
  return fs.promises.writeFile(filename, data, {
    flag,
    mode: options.perm
  });
}

/** Asynchronously write string `data` to the given `path`, by default creating a new file if needed,
 * else overwriting.
 *
 * ```ts
 * await Deno.writeTextFile("hello1.txt", "Hello world\n");  // overwrite "hello1.txt" or create it
 * ```
 *
 * Requires `allow-write` permission, and `allow-read` if `options.create` is `false`.
 */

export function writeTextFile(
  filename: string,
  data: string,
  options?: WriteFileOptions
): Promise<void> {
  const encoder = new TextEncoder();
  const UTF8Data = encoder.encode(data);
  return writeFile(filename, UTF8Data, options);
}

/** Synchronously write string `data` to the given `path`, by default creating a new file if needed,
 * else overwriting.
 *
 * ```ts
 * await Deno.writeTextFileSync("hello1.txt", "Hello world\n");  // overwrite "hello1.txt" or create it
 * ```
 *
 * Requires `allow-write` permission, and `allow-read` if `options.create` is `false`.
 */
export function writeTextFileSync(
  filename: string,
  data: string,
  options?: WriteFileOptions
): void {
  const encoder = new TextEncoder();
  const UTF8Data = encoder.encode(data);
  return writeFileSync(filename, UTF8Data);
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
export enum ErrorKind {
  NoError = 0,
  NotFound = 1,
  PermissionDenied = 2,
  ConnectionRefused = 3,
  ConnectionReset = 4,
  ConnectionAborted = 5,
  NotConnected = 6,
  AddrInUse = 7,
  AddrNotAvailable = 8,
  BrokenPipe = 9,
  AlreadyExists = 10,
  WouldBlock = 11,
  InvalidInput = 12,
  InvalidData = 13,
  TimedOut = 14,
  Interrupted = 15,
  WriteZero = 16,
  Other = 17,
  UnexpectedEof = 18,
  BadResource = 19,
  CommandFailed = 20,
  EmptyHost = 21,
  IdnaError = 22,
  InvalidPort = 23,
  InvalidIpv4Address = 24,
  InvalidIpv6Address = 25,
  InvalidDomainCharacter = 26,
  RelativeUrlWithoutBase = 27,
  RelativeUrlWithCannotBeABaseBase = 28,
  SetHostOnCannotBeABaseUrl = 29,
  Overflow = 30,
  HttpUser = 31,
  HttpClosed = 32,
  HttpCanceled = 33,
  HttpParse = 34,
  HttpOther = 35,
  TooLarge = 36,
  InvalidUri = 37,
  InvalidSeekMode = 38,
  OpNotAvailable = 39,
  WorkerInitFailed = 40,
  UnixError = 41,
  NoAsyncSupport = 42,
  NoSyncSupport = 43,
  ImportMapError = 44,
  InvalidPath = 45,
  ImportPrefixMissing = 46,
  UnsupportedFetchScheme = 47,
  TooManyRedirects = 48,
  Diagnostic = 49,
  JSError = 50
}

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
export class DenoError<T extends ErrorKind> extends Error {
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

/** Permissions as granted by the caller
 * See: https://w3c.github.io/permissions/#permission-registry
 */
export type PermissionName =
  | "run"
  | "read"
  | "write"
  | "net"
  | "env"
  | "hrtime";
/** https://w3c.github.io/permissions/#status-of-a-permission */
export type PermissionState = "granted" | "denied" | "prompt";

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
  state: PermissionState;

  constructor(state: PermissionState) {
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
  return fs.promises.truncate(name, len);
}

export interface Metrics {
  opsDispatched: number;
  opsCompleted: number;
  bytesSentControl: number;
  bytesSentData: number;
  bytesReceived: number;
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
export function metrics(): Metrics {
  return {
    opsCompleted: 0,
    opsDispatched: 0,
    bytesReceived: 0,
    bytesSentControl: 0,
    bytesSentData: 0
  };
}

// @url js/resources.d.ts

export interface ResourceMap {
  [rid: number]: string;
}

/** Returns a map of open _file like_ resource ids along with their string
 * representation.
 */
export function resources(): ResourceMap {
  return ResourceTable.map();
}

type ProcessStdio = "inherit" | "piped" | "null";
export interface RunOptions {
  args: string[];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
  stdout?: ProcessStdio | number;
  stderr?: ProcessStdio | number;
  stdin?: ProcessStdio | number;
}

/** Send a signal to process under given PID. Unix only at this moment.
 * If pid is negative, the signal will be sent to the process group identified
 * by -pid.
 * Requires the `--allow-run` flag.
 */
export function kill(pid: number, signo: number): void {
  process.kill(pid, signo);
}

export interface DenoProcess {
  readonly rid: number;
  readonly pid: number;
  readonly stdin?: WriteCloser;
  readonly stdout?: ReadCloser;
  readonly stderr?: ReadCloser;
  status(): Promise<ProcessStatus>;

  /** Buffer the stdout and return it as Uint8Array after EOF.
   * You must set stdout to "piped" when creating the process.
   * This calls close() on stdout after its done.
   */
  output(): Promise<Uint8Array>;

  /** Buffer the stderr and return it as Uint8Array after EOF.
   * You must set stderr to "piped" when creating the process.
   * This calls close() on stderr after its done.
   */
  stderrOutput(): Promise<Uint8Array>;

  close(): void;

  kill(signo: number): void;
}

export { DenoProcessImpl as Process };

export interface ProcessStatus {
  success: boolean;
  code?: number;
  signal?: number;
}
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
export function run(opt: RunOptions): DenoProcess {
  const [cmd, ...args] = opt.args;
  const p = cp.spawn(cmd, args, {
    cwd: opt.cwd,
    env: opt.env
  });
  return ResourceTable.openProcess(p);
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
  return util.inspect(value, options);
}
// export type OperatingSystem = "mac" | "win" | "linux";
//'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.
export type OperatingSystem = string;
// export type Arch = "x64" | "arm64";
//'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', 'x32', and 'x64'.
export type Arch = string;
/** Build related information */
interface BuildInfo {
  /** The CPU architecture. */
  arch: Arch;
  /** The operating system. */
  os: OperatingSystem;
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

export * from "./buffer";
export * from "./net";
