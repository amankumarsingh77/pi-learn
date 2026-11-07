import { afterEach, expect, test } from "bun:test";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

let learn: LoadedPiLearn;

afterEach(() => learn.cleanup());

test("SC29: /learn frobnicate warns with a usage line for each of new, resume, list, profile, share, stop and revise", async () => {
  learn = await loadPiLearn();

  await learn.fake.command("/learn frobnicate");

  expect(learn.fake.state.notices).toHaveLength(1);
  const [notice] = learn.fake.state.notices;
  expect(notice?.type).toBe("warning");
  const lines = notice?.message.split("\n").slice(1) ?? [];
  expect(lines.map((line) => line.trim().split(/\s+/)[1])).toEqual([
    "new",
    "resume",
    "list",
    "profile",
    "share",
    "stop",
    "revise",
  ]);
});
