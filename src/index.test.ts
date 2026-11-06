import { expect, test } from "bun:test";

test("the project scaffold loads", async () => {
  await expect(import("./index")).resolves.toBeDefined();
});
