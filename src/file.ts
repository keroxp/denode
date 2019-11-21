import * as fs from "fs";
import { ResourceTable } from "./resources";
import { DenoFile, EOF, SeekMode } from "./deno";

export class DenoFileImpl implements DenoFile {
  private loc = 0;

  constructor(readonly rid: number, readonly handle: fs.promises.FileHandle) {}

  async write(p: Uint8Array): Promise<number> {
    const result = await this.handle.write(p, 0, p.byteLength, this.loc);
    this.loc += result.bytesWritten;
    return result.bytesWritten;
  }

  writeSync(p: Uint8Array): number {
    const written = fs.writeSync(this.handle.fd, p);
    this.loc += written;
    return written;
  }

  async read(p: Uint8Array): Promise<number | EOF> {
    const result = await this.handle.read(p, 0, p.byteLength, this.loc);
    this.loc += result.bytesRead;
    return result.bytesRead === 0 ? EOF : result.bytesRead;
  }

  readSync(p: Uint8Array): number | EOF {
    const result = fs.readSync(this.handle.fd, p, 0, p.byteLength, this.loc);
    this.loc += result;
    return result === 0 ? EOF : result;
  }

  async seek(offset: number, whence: SeekMode): Promise<void> {
    if (whence === SeekMode.SEEK_START) {
      this.loc = offset;
    } else if (whence === SeekMode.SEEK_CURRENT) {
      this.loc += offset;
    } else if (whence === SeekMode.SEEK_END) {
      const stats = await this.handle.stat();
      this.loc = stats.size - offset;
    }
  }

  seekSync(offset: number, whence: SeekMode): void {
    if (whence === SeekMode.SEEK_START) {
      this.loc = offset;
    } else if (whence === SeekMode.SEEK_CURRENT) {
      this.loc += offset;
    } else if (whence === SeekMode.SEEK_END) {
      const stats = fs.fstatSync(this.handle.fd);
      this.loc = stats.size - offset;
    }
  }

  close(): void {
    try {
      fs.closeSync(this.handle.fd);
    } finally {
      ResourceTable.delete(this.rid);
    }
  }
}
