import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

const NOTES = "http-round-trip.md";
const START_FROM = "knows what a URL is; start at what the browser sends";

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
  await learn.fake.command("/learn new http round trip");
  await learn.learnerSays("a request goes out and a page comes back");
  await learn.fake.tool("learn_set_map", {
    goal: "explain what happens between typing a URL and seeing the page",
    nodes: [{ name: "request format", depth: "must know" }],
  });
});

afterEach(() => learn.cleanup());

const setPitch = (assume: readonly string[], define: readonly string[]) =>
  learn.fake.tool("learn_set_pitch", { start_from: START_FROM, assume, define });

describe("learn_set_pitch", () => {
  test("SC47: a pitch assuming URL, DNS and defining routing, port lands in the front matter and in the next turn's prompt", async () => {
    const result = await setPitch(["URL", "DNS"], ["routing", "port"]);

    expect(result.isError).toBe(false);
    expect(await learn.readText(NOTES)).toContain(
      [`start-from: ${START_FROM}`, "assume: URL, DNS", "define: routing, port"].join("\n"),
    );
    const section = (await learn.promptSections()).pi_learn;
    expect(section).toContain(`Pitch: ${START_FROM}`);
    expect(section).toContain("Use without explaining: URL, DNS");
    expect(section).toContain("Define in one line on first use: routing, port");
  });

  test("SC48: routing in both lists, then the term 'ports, sockets', are each refused naming the term and leave the notes unchanged", async () => {
    const before = await learn.readText(NOTES);

    const both = await setPitch(["URL", "routing"], ["routing"]);
    const comma = await setPitch(["URL"], ["ports, sockets"]);

    expect(both).toEqual({ isError: true, text: expect.stringContaining('"routing"') });
    expect(comma).toEqual({ isError: true, text: expect.stringContaining('"ports, sockets"') });
    expect(await learn.readText(NOTES)).toBe(before);
  });
});
