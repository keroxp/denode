import * as Deno from "../deno";
describe("io", () => {
  test("copy", async () => {
    const dest = new Deno.Buffer();
    const src = await Deno.open("fixtures/sample.txt");
    await Deno.copy(dest, src);
    expect(dest.toString()).toBe("Deno and Node");
  });
});
