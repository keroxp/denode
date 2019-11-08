import { EOF, Reader, Writer } from "./deno";

interface Deferred<T> extends Promise<T> {
  status(): "resolved" | "rejected" | undefined;
  resolve(t: T);
  reject(e);
}
export function deferred<T = void>(): Deferred<T> {
  let resolve, reject;
  let st: "resolved" | "rejected" | undefined;
  const p = new Promise<T>((a, b) => {
    resolve = (...args) => {
      try {
        a(...args);
      } finally {
        st = "resolved";
      }
    };
    reject = (...args) => {
      try {
        b(...args);
      } finally {
        st = "rejected";
      }
    };
  });
  return Object.assign(p, {
    resolve,
    reject,
    status() {
      return st;
    }
  });
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, i) => sum + i.byteLength, 0);
  const ret = new Uint8Array(total);
  let done = 0;
  for (const chunk of chunks) {
    ret.set(chunk, done);
    done += chunk.byteLength;
  }
  return ret;
}

export function streamToReader(stream: NodeJS.ReadableStream): Reader {
  let ended = false;
  let err: any | undefined;
  let buf: Uint8Array = new Uint8Array();
  let currDeferred = deferred();
  stream
    .on("data", chunk => {
      buf = concatBytes(buf, chunk);
      currDeferred.resolve();
      currDeferred = deferred();
    })
    .on("end", () => {
      ended = true;
    })
    .on("error", e => {
      err = e;
    });
  async function read(p: Uint8Array): Promise<number | EOF> {
    if (ended) {
      return EOF;
    } else if (err) {
      throw err;
    }
    const rem = Math.min(p.byteLength, buf.byteLength);
    if (rem > 0) {
      p.set(buf.subarray(0, rem));
      buf = buf.subarray(rem);
      return rem;
    } else {
      await currDeferred;
      return read(p);
    }
  }
  return { read };
}

export function streamToWriter(stream: NodeJS.WritableStream): Writer {
  async function write(p: Uint8Array): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      stream.write(p, err => {
        err ? reject(err) : resolve(p.byteLength);
      });
    });
  }
  return { write };
}
