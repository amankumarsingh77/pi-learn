import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { LearnDeps } from "./deps";
import { findLookupTools } from "./lookup-tools";
import type { TopicDoc } from "./model";
import { RUN_ENDED_MESSAGE, runEndedNote } from "./prompt";
import type { ActiveRun } from "./run";
import { renderMapTable } from "./store/topic-file";

export const RUN_ENTRY = "pi-learn-run";

export interface RunEntryData {
  readonly slug: string | null;
}

export function activateRun(deps: LearnDeps, run: ActiveRun): void {
  deps.slot.set(run);
  const active = deps.pi.getActiveTools();
  deps.pi.setActiveTools([...active, ...deps.toolNames.filter((name) => !active.includes(name))]);
}

export function attachRun(deps: LearnDeps, run: ActiveRun): void {
  activateRun(deps, run);
  deps.pi.appendEntry<RunEntryData>(RUN_ENTRY, { slug: run.slug });
}

function deactivate(deps: LearnDeps): void {
  deps.slot.set(undefined);
  const learnTools = new Set(deps.toolNames);
  deps.pi.setActiveTools(deps.pi.getActiveTools().filter((name) => !learnTools.has(name)));
}

export async function endRun(deps: LearnDeps, ctx: ExtensionContext): Promise<string> {
  const run = deps.slot.current();
  if (!run) throw new Error("no learn run is active");
  const doc = await deps.store.readTopic(run.slug).catch(() => undefined);
  deactivate(deps);
  deps.pi.appendEntry<RunEntryData>(RUN_ENTRY, { slug: null });
  // Appended now rather than as nextTurn: a queued nextTurn note would land after the kickoff
  // of a /learn new or resume sent before the learner's next message, and cancel that run.
  deps.pi.sendMessage(
    { customType: RUN_ENDED_MESSAGE, content: runEndedNote(run.slug), display: false },
    { triggerTurn: false },
  );
  const summary = runSummary(run.slug, doc, deps.store.topicPath(run.slug));
  ctx.ui.notify(summary, "info");
  return summary;
}

export async function restoreRun(deps: LearnDeps, ctx: ExtensionContext): Promise<void> {
  if (deps.slot.current()) deactivate(deps);
  const slug = ctx.sessionManager
    .getBranch()
    .flatMap((entry) =>
      entry.type === "custom" && entry.customType === RUN_ENTRY ? [savedSlug(entry.data)] : [],
    )
    .at(-1);
  if (!slug || !(await deps.store.readIndex()).topics[slug]) return;
  activateRun(deps, {
    slug,
    lookupTools: findLookupTools(deps.pi),
    firstRunEver: false,
    promotionOpen: false,
    // The restored session already holds the learner's messages.
    heardLearner: true,
  });
  ctx.ui.notify(`pi-learn: back in your learn run on ${slug}. /learn stop ends it.`, "info");
}

/** Session files are read back from disk, so a run entry's data is checked, not trusted. */
const savedSlug = (data: unknown): string | null =>
  typeof data === "object" && data !== null && "slug" in data && typeof data.slug === "string"
    ? data.slug
    : null;

function runSummary(slug: string, doc: TopicDoc | undefined, path: string): string {
  if (!doc) return `Learn run on ${slug} stopped.\n\nNotes: ${path}`;
  const parked =
    doc.skipped.length === 0
      ? []
      : [
          [
            "Parked side topics, ready as your next topic:",
            ...doc.skipped.map((item) => `- ${item}`),
          ].join("\n"),
        ];
  const verb = doc.status === "done" ? "finished" : "stopped";
  return [
    `Learn run on ${slug} ${verb}.`,
    renderMapTable(doc.nodes),
    ...parked,
    `Notes: ${path}`,
  ].join("\n\n");
}
