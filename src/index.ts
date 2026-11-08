import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerLearnCommand } from "./commands/table";
import type { LearnDeps } from "./deps";
import { errorMessage } from "./errors";
import { restoreRun } from "./lifecycle";
import { guardNotesFolder, notesPathForms } from "./notes-guard";
import { buildTeachingSection } from "./prompt";
import { type ActiveRun, closePromotion, createRunSlot, markHeardLearner } from "./run";
import { type Clock, createLearnStore } from "./store/learn-store";
import { LEARN_TOOLS, registerLearnTools } from "./tools/table";
import { registerCardRenderer } from "./ui/card";

export const PROMPT_SECTION = "pi_learn";

export interface PiLearnOptions {
  readonly root: string;
  readonly now?: Clock;
}

export function createPiLearn(options: PiLearnOptions): (pi: ExtensionAPI) => void {
  return (pi) => {
    const deps: LearnDeps = {
      pi,
      store: createLearnStore(options.root, options.now),
      slot: createRunSlot(),
      toolNames: LEARN_TOOLS.map((tool) => tool.name),
    };
    registerLearnTools(deps);
    registerLearnCommand(deps);
    registerCardRenderer(pi);
    pi.on("before_agent_start", async (event) => {
      const sections = event.systemPromptOptions.sections;
      const run = deps.slot.current();
      if (!run) {
        delete sections[PROMPT_SECTION];
        return;
      }
      sections[PROMPT_SECTION] = await teachingSection(deps, run);
    });
    pi.on("session_start", (_event, ctx) => restoreRun(deps, ctx));
    pi.on("turn_end", () => closePromotion(deps.slot));
    pi.on("tool_call", guardNotesFolder(deps, notesPathForms(options.root, homedir())));
    pi.on("input", (event) => {
      if (event.source !== "extension") markHeardLearner(deps.slot);
    });
  };
}

async function teachingSection(deps: LearnDeps, run: ActiveRun): Promise<string> {
  try {
    return buildTeachingSection(
      await deps.store.readTopic(run.slug),
      run,
      await deps.store.readProfile(),
    );
  } catch (error) {
    return `pi-learn could not read the notes for ${run.slug}: ${errorMessage(error)}. Tell the learner and suggest /learn stop.`;
  }
}

export const defaultLearnDir = (): string =>
  process.env.PI_LEARN_DIR ?? join(homedir(), ".pi", "learn");

export default createPiLearn({ root: defaultLearnDir() });
