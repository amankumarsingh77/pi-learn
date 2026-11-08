import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LearnDeps } from "../deps";
import { attachRun } from "../lifecycle";
import { findLookupTools } from "../lookup-tools";
import { byRecency } from "../model";
import {
  type CalibrationTopic,
  KICKOFF_MESSAGE,
  newRunKickoff,
  promotionPassDue,
  resumeKickoff,
} from "../prompt";
import type { ActiveRun } from "../run";
import type { LearnStore } from "../store/learn-store";
import { renderMapTable } from "../store/topic-file";
import { showCard } from "../ui/card";
import { slugify, topicId } from "../validate";
import type { Subcommand } from "./table";

const CALIBRATION_MAPS = 10;

export const newCommand: Subcommand = {
  usage: "new <topic>",
  summary: "calibrate, build a map, get a yes, teach",
  async run(args, ctx, deps) {
    const title = args.trim();
    const slug = topicId(title);
    if (slug === "") throw new Error("usage: /learn new <topic>");
    refuseIfActive(deps);
    if ((await deps.store.readIndex()).topics[slug]) {
      throw new Error(
        `a topic named ${slug} already exists; continue it with /learn resume ${slug}`,
      );
    }
    await deps.store.createTopic(slug, title);
    showCard(deps.pi, ctx, {
      title: `New topic: ${slug}`,
      body: `${title}\n\nNotes: \`${deps.store.topicPath(slug)}\`. Later: \`/learn resume ${slug}\`.`,
    });
    const earlier = await earlierTopics(deps.store, slug);
    const index = await deps.store.readIndex();
    const promotion = {
      run: index.runs + 1,
      profile: await deps.store.readProfile(),
      observations: (await deps.store.readObservations()).slice(index.observations_reviewed),
    };
    await startRun(deps, ctx, {
      slug,
      kickoff: newRunKickoff({ title, earlier, promotion }),
      promotionOpen: promotionPassDue(promotion),
    });
  },
};

export const resumeCommand: Subcommand = {
  usage: "resume <topic>",
  summary: "continue a topic at its first ◐ or ○ node",
  async run(args, ctx, deps) {
    const index = await deps.store.readIndex();
    const slug = [slugify(args), topicId(args)].find((id) => id !== "" && index.topics[id]);
    if (slugify(args) === "") throw new Error("usage: /learn resume <topic>");
    refuseIfActive(deps);
    if (slug === undefined) throw new Error(`no topic named ${slugify(args)}; run /learn list`);
    const doc = await deps.store.readTopic(slug);
    await startRun(deps, ctx, { slug, kickoff: resumeKickoff(doc), promotionOpen: false });
  },
};

export function refuseIfActive(deps: LearnDeps): void {
  const run = deps.slot.current();
  if (run) throw new Error(`a learn run on ${run.slug} is active; run /learn stop first`);
}

interface RunStart {
  readonly slug: string;
  readonly kickoff: string;
  readonly promotionOpen: boolean;
}

export async function startRun(
  deps: LearnDeps,
  ctx: ExtensionCommandContext,
  { slug, kickoff, promotionOpen }: RunStart,
): Promise<void> {
  const index = await deps.store.updateIndex((current) => ({ ...current, runs: current.runs + 1 }));
  const run: ActiveRun = {
    slug,
    lookupTools: findLookupTools(deps.pi),
    firstRunEver: index.runs === 1,
    promotionOpen,
    heardLearner: false,
    awaitingAgreement: false,
  };
  attachRun(deps, run);
  if (run.lookupTools.length === 0) {
    ctx.ui.notify(
      "pi-learn: no search or fetch tools found, so claims in this run cannot be fact-checked.",
      "warning",
    );
  }
  deps.pi.sendMessage(
    { customType: KICKOFF_MESSAGE, content: kickoff, display: false },
    { triggerTurn: true },
  );
}

async function earlierTopics(store: LearnStore, exclude: string): Promise<CalibrationTopic[]> {
  const entries = byRecency(await store.readIndex()).filter(([slug]) => slug !== exclude);
  return Promise.all(
    entries.map(async ([slug, entry], rank) => {
      const doc = await store.readTopic(slug).catch(() => undefined);
      const withMap = rank < CALIBRATION_MAPS && doc !== undefined && doc.nodes.length > 0;
      return {
        slug,
        title: entry.title,
        status: entry.status,
        goal: doc?.goal ?? "",
        assume: doc?.pitch.assume ?? [],
        ...(withMap ? { map: renderMapTable(doc.nodes) } : {}),
      };
    }),
  );
}
