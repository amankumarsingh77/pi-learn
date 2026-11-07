import { afterEach, describe, expect, test } from "bun:test";
import { notesPathForms } from "./notes-guard";
import { type LoadedPiLearn, loadPiLearn } from "./testing/harness";

let learn: LoadedPiLearn;

afterEach(() => learn.cleanup());

const call = (toolName: string, input: Record<string, unknown>) =>
  learn.fake.emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName, input });

describe("blocking reads of the notes folder during a run", () => {
  test("SC70: during a run, bash and read calls that name the notes folder are blocked with a reason pointing at the learn_* tools", async () => {
    learn = await loadPiLearn();
    await learn.fake.command("/learn new dns");

    const results = [
      ...(await call("bash", { command: `cat ${learn.root}/dns.md` })),
      ...(await call("read", { path: `${learn.root}/observations.jsonl` })),
    ];

    expect(results).toEqual([
      { block: true, reason: expect.stringContaining("learn_*") },
      { block: true, reason: expect.stringContaining("learn_*") },
    ]);
  });

  test("SC71: other paths during a run, and the notes folder with no run active, are not blocked", async () => {
    learn = await loadPiLearn();

    expect(await call("bash", { command: `cat ${learn.root}/dns.md` })).toEqual([undefined]);
    await learn.fake.command("/learn new dns");
    expect(await call("read", { path: "/media/project/src/prompt.ts" })).toEqual([undefined]);
  });

  test("SC72: the notes folder under the home folder is also matched as ~/ and $HOME/", () => {
    expect(notesPathForms("/home/ada/.pi/learn", "/home/ada")).toEqual([
      "/home/ada/.pi/learn",
      "~/.pi/learn",
      "$HOME/.pi/learn",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the shell spelling, not a template
      "${HOME}/.pi/learn",
    ]);
    expect(notesPathForms("/data/learn", "/home/ada")).toEqual(["/data/learn"]);
  });
});
