import * as Deno from "../deno";
import { encode } from "../util";
import * as fs from "fs";

describe("fs", () => {
  describe("read", () => {
    const decode = (s: Uint8Array) => Buffer.from(s).toString();
    test("readFileSync", () => {
      const buf = Deno.readFileSync("./fixtures/sample.txt");
      expect(decode(buf)).toBe("Deno and Node");
    });
    test("readFile", async () => {
      const buf = await Deno.readFile("./fixtures/sample.txt");
      expect(decode(buf)).toBe("Deno and Node");
    });
    test("open", async () => {
      const f = await Deno.open("./fixtures/sample.txt");
      const buf = new Deno.Buffer();
      await Deno.copy(buf, f);
      f.close();
      expect(buf.toString()).toBe("Deno and Node");
    });
    test("openSync", async () => {
      expect(() => {
        Deno.openSync("./fixtures/sample.txt");
      }).toThrowError(Error);
    });
    test("close", async () => {
      const resCount = Object.entries(Deno.resources()).length;
      const f = await Deno.open("./fixtures/sample.txt");
      expect(Object.entries(Deno.resources()).length).toBe(resCount + 1);
      expect(Deno.resources()[f.rid]).toBe("file");
      Deno.close(f.rid);
      expect(Object.entries(Deno.resources()).length).toBe(resCount);
    });
  });
  describe("write", () => {
    beforeAll(async () => {
      await fs.promises.mkdir("./tmp");
    });
    async function assertFile(path: string, content: string) {
      const v = await fs.promises.readFile(path);
      expect(v.toString()).toBe(content);
    }
    afterAll(async () => {
      await fs.promises.rmdir("./tmp", { recursive: true });
    });
    test("writeFileSync", async () => {
      const dest = "./tmp/writeFileSync.txt";
      const exp = "Deno and Node";
      Deno.writeFileSync(dest, encode(exp));
      await assertFile(dest, exp);
    });
    test("writeFile", async () => {
      const dest = "./tmp/writeFile.txt";
      const exp = "Deno and Node";
      await Deno.writeFile(dest, encode(exp));
      await assertFile(dest, exp);
    });
    test("writeSync", async () => {
      const dest = "./tmp/writeSync.txt";
      const exp = "Deno and Node";
      const f = await Deno.open(dest, "w");
      Deno.writeSync(f.rid, encode(exp));
      f.close();
      await assertFile(dest, exp);
    });
    test("write", async () => {
      const dest = "./tmp/write.txt";
      const exp = "Deno and Node";
      const f = await Deno.open(dest, "w");
      await Deno.write(f.rid, encode(exp));
      f.close();
      await assertFile(dest, exp);
    });
  });
  test("mkdir", async () => {
    await Deno.mkdir("./mkdir");
    const stat = await fs.promises.stat("./mkdir");
    expect(stat.isDirectory()).toBe(true);
    await fs.promises.rmdir("./mkdir");
  });
  test("mkdir -p", async () => {
    await Deno.mkdir("./mkdir/sub/dir", true);
    const stat = await fs.promises.stat("./mkdir/sub/dir");
    expect(stat.isDirectory()).toBe(true);
    await fs.promises.rmdir("./mkdir/sub/dir", { recursive: true });
  });
  test("mkdirSync", async () => {
    Deno.mkdirSync("./mkdirSync");
    const stat = await fs.promises.stat("./mkdirSync");
    expect(stat.isDirectory()).toBe(true);
    await fs.promises.rmdir("./mkdirSync");
  });
  test("mkdirSync -p", async () => {
    Deno.mkdirSync("./mkdirSync/sub/dir", true);
    const stat = await fs.promises.stat("./mkdirSync/sub/dir");
    expect(stat.isDirectory()).toBe(true);
    await fs.promises.rmdir("./mkdirSync/sub/dir");
  });
});
