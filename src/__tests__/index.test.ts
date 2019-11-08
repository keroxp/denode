import * as Deno from "../denode";
import * as os from "os";
import * as path from "path";

describe("main", () => {
  test("pid", () => {
    expect(Deno.pid).toBe(process.pid);
  });
  test("noColor", () => {
    expect(Deno.noColor).toBe(true);
  });
  test("isTTY", () => {
    expect(Deno.isTTY()).toMatchObject({
      stdin: process.stdin.isTTY,
      stdout: process.stdout.isTTY,
      stderr: process.stderr.isTTY
    });
  });
  test("hostname", () => {
    expect(Deno.hostname()).toBe(os.hostname());
  });
  test("homedir", () => {
    expect(Deno.homeDir()).toBe(os.homedir());
  });
  test("execPath", () => {
    expect(Deno.execPath()).toBe(process.execPath);
  });
  test("cwd", () => {
    expect(Deno.cwd()).toBe(process.cwd());
  });
  test("chdir", () => {
    const cwd = process.cwd();
    Deno.chdir("node_modules");
    expect(Deno.cwd()).toBe(process.cwd());
    expect(Deno.cwd()).toBe(path.join(cwd, "node_modules"));
    Deno.chdir(cwd);
  });
});
