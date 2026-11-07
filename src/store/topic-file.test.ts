import { describe, expect, test } from "bun:test";
import { EMPTY_PITCH, type TopicDoc } from "../model";
import { gapOf, parseTopic, renderNodeBody, renderTopic, TopicParseError } from "./topic-file";

const doc: TopicDoc = {
  slug: "http-round-trip",
  goal: "explain what happens between typing a URL and seeing the page",
  pitch: EMPTY_PITCH,
  status: "in-progress",
  nodes: [
    { name: "DNS lookup", depth: "must know", state: "●" },
    { name: "request format", depth: "must know", state: "◐" },
    { name: "keep-alive", depth: "enough", state: "○" },
  ],
  sections: {
    "DNS lookup": [
      "The browser asks a resolver for the IP behind the name.",
      "```",
      "browser ──► resolver ──► root",
      "## not a heading, part of the diagram",
      "```",
      'my words: "it asks a phone book"',
    ].join("\n"),
    "request format": [
      "A request is a start line, headers, a blank line and a body.",
      "```",
      "GET / HTTP/1.1",
      "Host: example.com",
      "```",
      "gap: thinks the body is required",
    ].join("\n"),
  },
  skipped: ["HTTP/2 framing (not asked)", "TLS handshake (parked prerequisite)"],
};

describe("topic notes file", () => {
  test("SC1: a rendered TopicDoc with a ## line inside a diagram parses back to an equal doc", () => {
    const text = renderTopic(doc);

    expect(parseTopic(text)).toEqual(doc);
    expect(text.startsWith("---\ntopic: http-round-trip\n")).toBe(true);
    expect(text).toContain("## Map\n| # | node | depth | state |");
    expect(text).toContain("## 1. DNS lookup  ●\n");
    expect(text).toContain("```\nbrowser ──► resolver ──► root\n## not a heading");
  });

  test("SC2: a map row 2 with state ? throws TopicParseError naming that row's line", () => {
    const lines = renderTopic(doc).split("\n");
    const row = lines.findIndex((line) => line.startsWith("| 2 |"));
    const broken = lines.map((line, i) => (i === row ? line.replace("◐", "?") : line)).join("\n");

    const parse = () => parseTopic(broken);

    expect(parse).toThrow(TopicParseError);
    expect(parse).toThrow(new RegExp(`^line ${row + 1}:`));
  });

  test("SC46: a pitch of one sentence, 2 assumed and 3 defined terms sits between goal and status and parses back; notes with no pitch lines parse with an empty pitch", () => {
    const pitched: TopicDoc = {
      ...doc,
      pitch: {
        startFrom: "knows what a URL is; start at what the browser sends",
        assume: ["URL", "DNS"],
        define: ["routing", "port", "status code"],
      },
    };

    const text = renderTopic(pitched);

    expect(parseTopic(text)).toEqual(pitched);
    expect(text).toContain(
      [
        `goal: ${doc.goal}`,
        "start-from: knows what a URL is; start at what the browser sends",
        "assume: URL, DNS",
        "define: routing, port, status code",
        "status: in-progress",
      ].join("\n"),
    );
    const oldNotes = "---\ntopic: dns\ngoal: name to address\nstatus: done\n---\n\n## Map\n";
    expect(parseTopic(oldNotes).pitch).toEqual({ startFrom: "", assume: [], define: [] });
  });

  const fieldLines = [
    'my words: "the server just runs the code?"',
    "the trap I fell into: thought the handler ran before routing",
    "gap: didn't know about routing before the handler",
    "sources: https://example.com/routing",
  ];

  test("SC61: a node with my words, a trap, a gap and sources renders each field as its own Markdown paragraph, and render, parse, render gives the same text", () => {
    const body = renderNodeBody({
      explanation: "The server matches the path to a handler.",
      diagram: "request ──► router ──► handler",
      learnerWords: "the server just runs the code?",
      trap: "thought the handler ran before routing",
      gap: "didn't know about routing before the handler",
      sources: ["https://example.com/routing"],
    });

    expect(body).toBe(
      [
        "The server matches the path to a handler.",
        "```",
        "request ──► router ──► handler",
        "```",
        fieldLines.join("\n\n"),
      ].join("\n"),
    );
    const text = renderTopic({ ...doc, sections: { ...doc.sections, "keep-alive": body } });
    expect(renderTopic(parseTopic(text))).toBe(text);
    expect(parseTopic(text).sections["keep-alive"]).toBe(body);
  });

  test("SC62: notes whose node fields sit on consecutive lines still parse, keep the gap, and render back with each field as its own paragraph", () => {
    const oldBody = ["Old explanation.", "```", "a ──► b", "```", ...fieldLines].join("\n");
    const oldText = renderTopic({ ...doc, sections: { "keep-alive": oldBody } });

    const parsed = parseTopic(oldText);

    const body = parsed.sections["keep-alive"] ?? "";
    expect(gapOf(body)).toBe("didn't know about routing before the handler");
    expect(body).toBe(
      ["Old explanation.", "```", "a ──► b", "```", fieldLines.join("\n\n")].join("\n"),
    );
    expect(renderTopic(parseTopic(renderTopic(parsed)))).toBe(renderTopic(parsed));
  });
});
