import * as Deno from "../deno";

describe("fs", () => {
  const decode = (s: Uint8Array) => Buffer.from(s).toString();
  test("readFileSync", () => {
    const buf = Deno.readFileSync("./fixtures/sample.txt");
    expect(decode(buf)).toBe("Deno and Node");
  });
  test("readFile", async () => {
    const buf = await Deno.readFile("./fixtures/sample.txt");
    expect(decode(buf)).toBe("Deno and Node");
  });
});
