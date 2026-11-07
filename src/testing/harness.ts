import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPiLearn } from "../index";
import { createLearnStore, type LearnStore } from "../store/learn-store";
import { LEARN_TOOLS } from "../tools/table";
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
    async promptSections(sectionsSeed = {}) {
      const sections = { ...sectionsSeed };
      await fake.emit("before_agent_start", { systemPromptOptions: { sections } });
      return sections;
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
