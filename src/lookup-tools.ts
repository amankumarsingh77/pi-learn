import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LOOKUP_WORDS = /search|fetch|browse|browser|web|docs|context7|lookup|wiki/i;

export function findLookupTools(pi: Pick<ExtensionAPI, "getAllTools">): string[] {
  return pi
    .getAllTools()
    .filter((tool) => tool.exposure !== "hidden" && !tool.name.startsWith("learn_"))
    .map((tool) => tool.name)
    .filter((name) => LOOKUP_WORDS.test(name));
}
