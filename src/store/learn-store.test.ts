import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLearnStore } from "./learn-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pi-learn-store-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("SC15: store A creating topic a and store B creating topic b on one dir keep both index entries and leave no .tmp files", async () => {
  const storeA = createLearnStore(root);
  const storeB = createLearnStore(root);

  await storeA.createTopic("a", "Topic A");
  await storeB.createTopic("b", "Topic B");

  const index = await storeA.readIndex();
  expect(Object.keys(index.topics).sort()).toEqual(["a", "b"]);
  const files = await readdir(root);
  expect(files.filter((file) => file.endsWith(".tmp"))).toEqual([]);
});
