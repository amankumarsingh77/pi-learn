import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MapNode } from "../model";
import { CODING_TOOLS } from "../testing/fake-pi";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

const SLUG = "http-round-trip";

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
});

afterEach(() => learn.cleanup());

/** An active run on http-round-trip whose map is already at the given node states. */
async function startRunAt(nodes: readonly MapNode[], skipped: readonly string[] = []) {
  await learn.fake.command("/learn new http round trip");
  await learn.store.updateTopic(SLUG, (doc) => ({ ...doc, goal: "explain it", nodes, skipped }));
}

describe("learn_pause", () => {
  test("SC19: learn_pause returns the map table and notes path, empties the run slot and switches every learn tool off", async () => {
    await startRunAt([{ name: "DNS lookup", depth: "must know", state: "◐" }]);

    const result = await learn.fake.tool("learn_pause", {});

    expect(result.isError).toBe(false);
    expect(result.text).toContain("| 1 | DNS lookup | must know | ◐ |");
    expect(result.text).toContain(learn.store.topicPath(SLUG));
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
    expect(await learn.promptSections()).not.toHaveProperty("pi_learn");
  });
});

describe("ending a run from a tool", () => {
  test.each(["learn_pause", "learn_finish"])(
    "SC64: %s tells the model, without starting a turn, that the run on http-round-trip ended",
    async (tool) => {
      await startRunAt([{ name: "DNS lookup", depth: "must know", state: "●" }]);
      learn.fake.state.sent.length = 0;

      await learn.fake.tool(tool, {});

      expect(learn.fake.state.sent).toEqual([
        expect.objectContaining({
          customType: "pi-learn-run-ended",
          content: expect.stringContaining("The learn run on http-round-trip has ended"),
          triggerTurn: false,
        }),
      ]);
    },
  );
});

describe("learn_finish", () => {
  test("SC20: learn_finish with must-know node 2 at ◐ is an error naming node 2, and the topic stays in-progress with the run active", async () => {
    await startRunAt([
      { name: "DNS lookup", depth: "must know", state: "●" },
      { name: "request format", depth: "must know", state: "◐" },
    ]);

    const result = await learn.fake.tool("learn_finish", {});

    expect(result).toEqual({ isError: true, text: expect.stringContaining("request format") });
    expect(result.text).not.toContain("DNS lookup");
    expect((await learn.store.readTopic(SLUG)).status).toBe("in-progress");
    expect((await learn.store.readIndex()).topics[SLUG]?.status).toBe("in-progress");
    expect(learn.fake.state.active).toContain("learn_finish");
    expect((await learn.promptSections()).pi_learn).toContain(`Topic: ${SLUG}.`);
  });

  test("SC21: learn_finish with both must-know nodes ● and an enough node ○ marks the topic done, lists the parked topic and ends the run", async () => {
    await startRunAt(
      [
        { name: "DNS lookup", depth: "must know", state: "●" },
        { name: "request format", depth: "must know", state: "●" },
        { name: "keep-alive", depth: "enough", state: "○" },
      ],
      ["HTTP/2 framing (not asked)"],
    );

    const result = await learn.fake.tool("learn_finish", {});

    expect(result.isError).toBe(false);
    expect(await learn.readText(`${SLUG}.md`)).toContain("status: done");
    expect((await learn.store.readIndex()).topics[SLUG]?.status).toBe("done");
    expect(result.text).toContain(`Learn run on ${SLUG} finished`);
    expect(result.text).toContain("- HTTP/2 framing (not asked)");
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
    expect(await learn.promptSections()).not.toHaveProperty("pi_learn");
  });
});
