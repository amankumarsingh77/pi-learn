import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPiLearn } from "../index";
import { createLearnStore, type LearnStore } from "../store/learn-store";
import { LEARN_TOOLS } from "../tools/table";
import { CARD_ENTRY, type CardData } from "../ui/card";
import { CODING_TOOLS, createFakePi, type FakePi, type SavedEntry } from "./fake-pi";

export const FIXED_NOW = "2026-11-07T10:00:00.000Z";

/** Active tools while a run is on: pi's coding tools, then every learn_* tool. */
export const RUN_TOOLS: readonly string[] = [
  ...CODING_TOOLS,
  ...LEARN_TOOLS.map((tool) => tool.name),
];

export interface LoadedPiLearn {
  readonly fake: FakePi;
  readonly root: string;
  readonly store: LearnStore;
  readText(file: string): Promise<string>;
  /** The cards pi-learn has shown in the chat, oldest first. */
  cards(): CardData[];
  /** Fires pi's input event for a message the learner typed. */
  learnerSays(text: string): Promise<void>;
  /** Fires before_agent_start the way pi does and returns the sections object it was given. */
  promptSections(seed?: Record<string, string>): Promise<Record<string, string>>;
  cleanup(): Promise<void>;
}

export async function loadPiLearn(
  seed: { entries?: SavedEntry[]; otherTools?: string[] } = {},
): Promise<LoadedPiLearn> {
  const root = await mkdtemp(join(tmpdir(), "pi-learn-"));
  const fake = createFakePi(seed);
  createPiLearn({ root, now: () => FIXED_NOW })(fake.api);
  return {
    fake,
    root,
    store: createLearnStore(root, () => FIXED_NOW),
    readText: (file) => readFile(join(root, file), "utf8"),
    cards: () =>
      fake.state.entries.flatMap((entry) =>
        entry.customType === CARD_ENTRY ? [entry.data as CardData] : [],
      ),
    async learnerSays(text) {
      await fake.emit("input", { type: "input", text, source: "interactive" });
    },
    async promptSections(sectionsSeed = {}) {
      const sections = { ...sectionsSeed };
      await fake.emit("before_agent_start", { systemPromptOptions: { sections } });
      return sections;
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
