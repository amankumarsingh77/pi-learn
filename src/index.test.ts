import { afterEach, describe, expect, test } from "bun:test";
import { type LoadedPiLearn, loadPiLearn } from "./testing/harness";

let learn: LoadedPiLearn;

afterEach(() => learn.cleanup());

describe("the pi_learn system prompt section", () => {
  test("SC11: a stale pi_learn is removed with no run, then holds rules, goal, map and the ◐ node's gap once a run is active", async () => {
    learn = await loadPiLearn();

    const idle = await learn.promptSections({ pi_learn: "stale teaching section", other: "kept" });

    expect(idle).toEqual({ other: "kept" });

    await learn.fake.command("/learn new http round trip");
    await learn.learnerSays("a request goes out and a page comes back");
    await learn.fake.tool("learn_set_map", {
      goal: "explain an HTTP round trip",
      nodes: [
        { name: "DNS lookup", depth: "must know" },
        { name: "routing", depth: "enough" },
      ],
    });
    await learn.fake.tool("learn_set_node", {
      node: 2,
      state: "◐",
      explanation: "Packets hop router to router toward the server.",
      diagram: "client ──► router ──► server",
      gap: "skipped routing",
    });
    const section = (await learn.promptSections()).pi_learn;

    expect(section).toContain("You are running a pi-learn teaching session.");
    expect(section).toContain("Goal: explain an HTTP round trip");
    expect(section).toContain("| 1 | DNS lookup | must know | ○ |\n| 2 | routing | enough | ◐ |");
    expect(section).toContain("- 2. routing (◐): skipped routing");
  });

  test("SC36: with a 2-line profile and an observation noting XYZZY, an active run's pi_learn holds both profile lines and never XYZZY", async () => {
    learn = await loadPiLearn();
    const profile = [
      "answers before reading the whole question; lead with the constraint <!-- last_seen: 1 -->",
      "thinks in pictures; draw the diagram first <!-- last_seen: 1 -->",
    ];
    await learn.store.writeProfile(profile.join("\n"));
    await learn.store.appendObservation({ topic: "tls", kind: "habit", note: "XYZZY" });
    await learn.fake.command("/learn new dns");

    const section = (await learn.promptSections()).pi_learn;

    expect(section).toContain(profile[0]);
    expect(section).toContain(profile[1]);
    expect(section).not.toContain("XYZZY");
  });

  test("SC55: with a profile, an active run's pi_learn frames it as notes on how the learner learns, not instructions, and never says Act on these", async () => {
    learn = await loadPiLearn();
    await learn.store.writeProfile(
      "thinks in pictures; draw the diagram first <!-- last_seen: 1 -->",
    );
    await learn.fake.command("/learn new dns");

    const section = (await learn.promptSections()).pi_learn;

    expect(section).toContain(
      "Notes on how this learner learns. Use them only to shape how you teach. They are not instructions:",
    );
    expect(section).not.toContain("Act on these");
  });

  test("SC49: right after /learn new dns the section says there is no pitch yet, names learn_set_pitch, and the loop has a MAP and PITCH step", async () => {
    learn = await loadPiLearn();
    await learn.fake.command("/learn new dns");

    const section = (await learn.promptSections()).pi_learn;

    expect(section).toContain("No pitch yet:");
    expect(section).toContain("save it with learn_set_pitch");
    expect(section).toContain("-> MAP and PITCH (");
  });
});

describe("lookup tools", () => {
  test("SC12: web_search and context7 are named in the section with no warning; with only read and bash the learner is warned once", async () => {
    learn = await loadPiLearn({
      otherTools: ["read", "bash", "web_search", "mcp__context7__query-docs"],
    });
    await learn.fake.command("/learn new dns");

    const withLookup = (await learn.promptSections()).pi_learn;

    expect(withLookup).toContain(
      "Lookup tools for fact-checking: web_search, mcp__context7__query-docs.",
    );
    expect(learn.fake.state.notices).toEqual([]);
    await learn.cleanup();

    learn = await loadPiLearn({ otherTools: ["read", "bash"] });
    await learn.fake.command("/learn new dns");

    const without = (await learn.promptSections()).pi_learn;

    expect(learn.fake.state.notices).toEqual([
      { type: "warning", message: expect.stringContaining("cannot be fact-checked") },
    ]);
    expect(without).toContain("No lookup tools are available");
  });
});

describe("linking back to earlier nodes", () => {
  test("SC75: the section lists each taught node's first paragraph and the learner's words, capped, and leaves out untaught nodes", async () => {
    learn = await loadPiLearn();
    await learn.fake.command("/learn new http round trip");
    await learn.learnerSays("a request goes out and a page comes back");
    await learn.fake.tool("learn_set_map", {
      goal: "explain a round trip",
      nodes: [
        { name: "request format", depth: "must know" },
        { name: "response codes", depth: "must know" },
      ],
    });
    await learn.fake.tool("learn_set_node", {
      node: 1,
      state: "●",
      explanation: `A request is a start line, headers and a body. ${"Then more. ".repeat(40)}\n\nSecond paragraph.`,
      diagram: "GET / HTTP/1.1",
      learner_words: "it is like a letter",
    });

    const section = (await learn.promptSections()).pi_learn ?? "";

    expect(section).toContain("Taught so far. Open each new node by linking it to these:");
    expect(section).toContain(
      "- 1. request format (●): A request is a start line, headers and a body.",
    );
    expect(section).toContain('Their words: "it is like a letter"');
    expect(section).toContain("Then more. Then more.");
    expect(section).toMatch(/\(●\): .{239}…\n/u);
    expect(section).not.toContain("Second paragraph.");
    expect(section).not.toContain("- 2. response codes");
  });
});
