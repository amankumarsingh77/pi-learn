import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LearnDeps } from "../deps";
import { errorMessage } from "../errors";
import { listCommand, profileCommand, reviseCommand, stopCommand } from "./session";
import { shareCommand } from "./share";
import { newCommand, resumeCommand } from "./start";

export interface Subcommand {
  readonly usage: string;
  readonly summary: string;
  run(args: string, ctx: ExtensionCommandContext, deps: LearnDeps): Promise<void>;
}

export const SUBCOMMANDS: Readonly<Record<string, Subcommand>> = {
  new: newCommand,
  resume: resumeCommand,
  list: listCommand,
  profile: profileCommand,
  share: shareCommand,
  stop: stopCommand,
  revise: reviseCommand,
};

export function usageText(): string {
  const lines = Object.values(SUBCOMMANDS).map(
    (sub) => `  /learn ${sub.usage.padEnd(18)} ${sub.summary}`,
  );
  return ["Usage:", ...lines].join("\n");
}

export function registerLearnCommand(deps: LearnDeps): void {
  deps.pi.registerCommand("learn", {
    description: "Learn a topic: explain, ask, read your thinking, keep notes",
    getArgumentCompletions: (prefix) =>
      Object.keys(SUBCOMMANDS)
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ value: name, label: name })),
    handler: async (args, ctx) => {
      const [name = "", ...rest] = args.trim().split(/\s+/);
      const sub = SUBCOMMANDS[name];
      if (!sub) {
        ctx.ui.notify(usageText(), "warning");
        return;
      }
      try {
        await sub.run(rest.join(" "), ctx, deps);
      } catch (error) {
        ctx.ui.notify(`pi-learn: ${errorMessage(error)}`, "error");
      }
    },
  });
}
