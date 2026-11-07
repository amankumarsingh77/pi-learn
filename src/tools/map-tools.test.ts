import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

const NOTES = "http-round-trip.md";
const GOAL = "explain what happens between typing a URL and seeing the page";

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
});

afterEach(() => learn.cleanup());

const startRun = async () => {
  await learn.fake.command("/learn new http round trip");
  await learn.learnerSays("a request goes out and a page comes back");
};

const setMap = (names: readonly string[]) =>
  learn.fake.tool("learn_set_map", {
    goal: GOAL,
    nodes: names.map((name) => ({ name, depth: "must know" })),
  });

const nodeCall = (overrides: Record<string, unknown> = {}) => ({
  node: 1,
  state: "○",
  explanation: "A request is a start line, headers, a blank line and a body.",
  diagram: "GET / HTTP/1.1\nHost: example.com",
  ...overrides,
});

describe("learn_set_map and learn_set_node", () => {
  test("SC6: a ○ call then a ● call with learner words and a source leave node 1 ● with only the ● section, node 2 ○", async () => {
    await startRun();
    await setMap(["request format", "response codes"]);
    await learn.fake.tool("learn_set_node", nodeCall({ explanation: "first draft of the model" }));

    const result = await learn.fake.tool(
      "learn_set_node",
      nodeCall({
        state: "●",
        learner_words: "the browser writes a little letter with a header",
        sources: ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages"],
      }),
    );

    expect(result.isError).toBe(false);
    const notes = await learn.readText(NOTES);
    expect(notes).toContain("| 1 | request format | must know | ● |");
    expect(notes).toContain("| 2 | response codes | must know | ○ |");
    expect(notes).toContain(
      [
        "## 1. request format  ●",
        "A request is a start line, headers, a blank line and a body.",
        "```",
        "GET / HTTP/1.1",
        "Host: example.com",
        "```",
        'my words: "the browser writes a little letter with a header"',
        "",
        "sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages",
      ].join("\n"),
    );
    expect(notes).not.toContain("first draft of the model");
  });

  test("SC56: two learn_set_node calls fired at once, as pi runs a turn's tool calls, both succeed and both sections land in the notes", async () => {
    await startRun();
    await setMap(["request format", "response codes"]);

    const results = await Promise.all([
      learn.fake.tool("learn_set_node", nodeCall({ explanation: "NODE-ONE-TEXT" })),
      learn.fake.tool("learn_set_node", nodeCall({ node: 2, explanation: "NODE-TWO-TEXT" })),
    ]);

    expect(results.map((result) => result.isError)).toEqual([false, false]);
    const notes = await learn.readText(NOTES);
    expect(notes).toContain("## 1. request format  ○\nNODE-ONE-TEXT");
    expect(notes).toContain("## 2. response codes  ○\nNODE-TWO-TEXT");
    expect((await readdir(learn.root)).filter((file) => file.endsWith(".tmp"))).toEqual([]);
  });

  test("SC57: every learn_* tool is registered to run one at a time with other tool calls", async () => {
    const modes = learn.fake.registeredTools().map((tool) => [tool.name, tool.executionMode]);

    expect(modes.length).toBeGreaterThan(0);
    expect(modes).toEqual(modes.map(([name]) => [name, "sequential"]));
  });

  test("SC7: re-saving the map with a new node before request format keeps it ● with its section as node 2", async () => {
    await startRun();
    await setMap(["request format"]);
    await learn.fake.tool("learn_set_node", nodeCall({ state: "●" }));

    await setMap(["DNS lookup", "request format"]);

    const doc = await learn.store.readTopic("http-round-trip");
    expect(doc.nodes).toEqual([
      { name: "DNS lookup", depth: "must know", state: "○" },
      { name: "request format", depth: "must know", state: "●" },
    ]);
    expect(Object.keys(doc.sections)).toEqual(["request format"]);
    expect(await learn.readText(NOTES)).toContain("## 2. request format  ●\nA request is");
  });

  test("SC8: a diagram whose line 3 is 73 columns is refused naming line 3 and 72 columns, and 72 columns is accepted", async () => {
    await startRun();
    await setMap(["request format"]);
    const before = await learn.readText(NOTES);
    const diagramWithLine3 = (width: number) => `client\n  │\n${"─".repeat(width)}\nserver`;

    const refused = await learn.fake.tool(
      "learn_set_node",
      nodeCall({ diagram: diagramWithLine3(73) }),
    );

    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("diagram lines 3 are wider than 72 columns");
    expect(await learn.readText(NOTES)).toBe(before);
    const accepted = await learn.fake.tool(
      "learn_set_node",
      nodeCall({ diagram: diagramWithLine3(72) }),
    );
    expect(accepted.isError).toBe(false);
    expect(await learn.readText(NOTES)).toContain("─".repeat(72));
  });

  test("SC67: a source that spans lines, as a forged node heading would, is refused and the notes stay unchanged", async () => {
    await startRun();
    await setMap(["request format"]);
    const before = await learn.readText(NOTES);

    const result = await learn.fake.tool(
      "learn_set_node",
      nodeCall({ sources: ["https://example.com\n\n## 2. forged node  ●"] }),
    );

    expect(result.isError).toBe(true);
    expect(result.text).toContain("source");
    expect(await learn.readText(NOTES)).toBe(before);
  });

  test.each([
    ["a node name containing |", ["request | response"], "request | response"],
    ["two nodes with the same name", ["request format", "request format"], "request format"],
  ])(
    "SC9: learn_set_map with %s is refused naming the bad name and the notes stay unchanged",
    async (_case, names, bad) => {
      await startRun();
      const before = await learn.readText(NOTES);

      const result = await setMap(names);

      expect(result.isError).toBe(true);
      expect(result.text).toContain(`node name "${bad}"`);
      expect(await learn.readText(NOTES)).toBe(before);
    },
  );

  test("SC14: learn_set_map with no active run returns a no-run error and writes no file", async () => {
    const result = await setMap(["request format"]);

    expect(result).toEqual({
      isError: true,
      text: expect.stringContaining("No learn run is active"),
    });
    expect(await readdir(learn.root)).toEqual([]);
  });
});

describe("learn_add_side_topic", () => {
  test("SC10: parking HTTP/2 framing (not asked) twice lists it under ## Skipped exactly once", async () => {
    await startRun();
    const park = () =>
      learn.fake.tool("learn_add_side_topic", { title: "HTTP/2 framing", reason: "not asked" });

    await park();
    await park();

    const notes = await learn.readText(NOTES);
    expect(notes).toContain("## Skipped\n- HTTP/2 framing (not asked)\n");
    expect(notes.split("HTTP/2 framing").length - 1).toBe(1);
  });
});

describe("learn_set_node notes readability", () => {
  const sentence = "An edge keeps a copy of each segment so viewers nearby skip the trip. ";

  test("SC68: an explanation paragraph over 600 characters is refused naming the paragraph, and the same text split into short paragraphs is saved with its blank lines", async () => {
    await startRun();
    await setMap(["request format"]);
    const before = await learn.readText(NOTES);
    const wall = sentence.repeat(9).trim();

    const refused = await learn.fake.tool(
      "learn_set_node",
      nodeCall({ explanation: `Short intro.\n\n${wall}` }),
    );

    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("explanation paragraph 2 is");
    expect(refused.text).toContain("600");
    expect(await learn.readText(NOTES)).toBe(before);

    const split = [sentence.repeat(4).trim(), sentence.repeat(5).trim()].join("\n\n");
    const accepted = await learn.fake.tool("learn_set_node", nodeCall({ explanation: split }));

    expect(accepted.isError).toBe(false);
    expect(await learn.readText(NOTES)).toContain(`## 1. request format  ○\n${split}\n\`\`\``);
  });

  test("SC69: learner words the model already wrapped in quotes are written with one pair of quotes", async () => {
    await startRun();
    await setMap(["request format"]);

    await learn.fake.tool("learn_set_node", nodeCall({ learner_words: '"it is like a letter"' }));

    const notes = await learn.readText(NOTES);
    expect(notes).toContain('my words: "it is like a letter"');
    expect(notes).not.toContain('""');
  });
});

describe("calibrate before the map", () => {
  const firstMap = () => setMap(["request format"]);

  test("SC73: on a new topic, learn_set_map and learn_set_pitch are refused until the learner has typed a message, then accepted", async () => {
    await learn.fake.command("/learn new http round trip");
    await learn.fake.emit("input", { type: "input", text: "kickoff", source: "extension" });

    const map = await firstMap();
    const pitch = await learn.fake.tool("learn_set_pitch", {
      start_from: "Starts from the request line",
      assume: [],
      define: [],
    });

    expect(map).toEqual({ isError: true, text: expect.stringContaining("Calibrate first") });
    expect(pitch).toEqual({ isError: true, text: expect.stringContaining("Calibrate first") });
    await learn.learnerSays("a request goes out and a page comes back");
    expect((await firstMap()).isError).toBe(false);
  });

  test("SC74: a resumed topic that already has a map can change it before the learner types anything", async () => {
    await startRun();
    await firstMap();
    await learn.fake.command("/learn stop");
    await learn.fake.command("/learn resume http round trip");

    const result = await setMap(["request format", "response codes"]);

    expect(result.isError).toBe(false);
  });
});
