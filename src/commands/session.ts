import { endRun } from "../lifecycle";
import { byRecency, type IndexEntry } from "../model";
import { showCard } from "../ui/card";
import type { Subcommand } from "./table";

export const stopCommand: Subcommand = {
  usage: "stop",
  summary: "save, print the map, return pi to normal use",
  async run(_args, ctx, deps) {
    if (!deps.slot.current()) {
      ctx.ui.notify("No learning session is active in this pi session.", "info");
      return;
    }
    await endRun(deps, ctx);
  },
};

/** The learner's local calendar day as YYYY-MM-DD; en-CA is the locale that formats it so. */
const localDay = (iso: string): string => new Date(iso).toLocaleDateString("en-CA");

export const listCommand: Subcommand = {
  usage: "list",
  summary: "topics and their status",
  async run(_args, ctx, deps) {
    const topics = byRecency(await deps.store.readIndex());
    showCard(deps.pi, ctx, {
      title: topics.length === 1 ? "1 topic" : `${topics.length} topics`,
      body:
        topics.length > 0
          ? [
              "| Topic | Title | Status | Updated | Gist |",
              "| --- | --- | --- | --- | --- |",
              ...topics.map(([slug, entry]) => topicRow(slug, entry)),
              "",
              "Continue one with `/learn resume <topic>`; `/learn share <topic>` uploads its notes.",
            ].join("\n")
          : "No topics yet. Start one with `/learn new <topic>`.",
    });
  },
};

const topicRow = (slug: string, entry: IndexEntry): string =>
  `| \`${slug}\` | ${entry.title} | ${entry.status} | ${localDay(entry.updated)} | ${entry.gist ?? "–"} |`;

export const profileCommand: Subcommand = {
  usage: "profile",
  summary: "print what pi-learn has learned about you",
  async run(_args, ctx, deps) {
    const profile = (await deps.store.readProfile()).trim();
    showCard(deps.pi, ctx, {
      title: "Your learner profile",
      body:
        profile === ""
          ? "No profile yet. It grows from patterns pi-learn sees across your runs."
          : `${profile}\n\nEdit or delete lines by hand: \`${deps.store.profilePath}\``,
    });
  },
};

export const reviseCommand: Subcommand = {
  usage: "revise",
  summary: "planned: re-ask ● nodes from old topics",
  async run(_args, ctx) {
    ctx.ui.notify("/learn revise (spaced repetition) is planned but not built yet.", "info");
  },
};
