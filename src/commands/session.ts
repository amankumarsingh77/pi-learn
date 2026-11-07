import { endRun } from "../lifecycle";
import { byRecency } from "../model";
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
    const lines = byRecency(await deps.store.readIndex()).map(
      ([slug, entry]) =>
        `${slug}  ${entry.status}  updated ${localDay(entry.updated)}${entry.gist ? `  ${entry.gist}` : ""}`,
    );
    ctx.ui.notify(
      lines.length > 0 ? lines.join("\n") : "No topics yet. Start one with /learn new <topic>.",
      "info",
    );
  },
};

export const profileCommand: Subcommand = {
  usage: "profile",
  summary: "print what pi-learn has learned about you",
  async run(_args, ctx, deps) {
    const profile = (await deps.store.readProfile()).trim();
    ctx.ui.notify(
      profile === ""
        ? "No profile yet. It grows from patterns pi-learn sees across your runs."
        : `${profile}\n\nEdit or delete lines by hand: ${deps.store.profilePath}`,
      "info",
    );
  },
};

export const reviseCommand: Subcommand = {
  usage: "revise",
  summary: "planned: re-ask ● nodes from old topics",
  async run(_args, ctx) {
    ctx.ui.notify("/learn revise (spaced repetition) is planned but not built yet.", "info");
  },
};
