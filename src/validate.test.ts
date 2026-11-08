import { describe, expect, test } from "bun:test";
import { topicId } from "./validate";

describe("topicId", () => {
  test.each([
    [
      "How does CDN works for video streaming? What are the different types of it",
      "cdn-works-video-streaming",
    ],
    ["Teach me about the Raft consensus algorithm", "raft-consensus-algorithm"],
    ["DNS", "dns"],
    ["What is it?", "what-is-it"],
    ["  TLS 1.3 handshake, step by step  ", "tls-1-3-handshake"],
  ])("%s → %s", (title, id) => {
    expect(topicId(title)).toBe(id);
  });

  test("an empty or symbol-only title gives an empty id", () => {
    expect(topicId("")).toBe("");
    expect(topicId("???")).toBe("");
  });
});
