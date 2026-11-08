import type { LearnDeps } from "../deps";
import type { LearnIndex } from "../model";
import type { RunSlot } from "../run";
import { showCard } from "../ui/card";
import { slugify } from "../validate";
import type { Subcommand } from "./table";

const GH_MISSING =
  "gh is missing or not logged in. Install it from https://cli.github.com, then run: gh auth login";
const UNLISTED_NOTICE =
  "A private gist is unlisted, not access-controlled: anyone with the link can read it.";

interface GistUpload {
  readonly deps: LearnDeps;
  readonly slug: string;
  readonly path: string;
}

export const shareCommand: Subcommand = {
  usage: "share [topic]",
  summary: "upload a topic's notes to a private gist",
  async run(args, ctx, deps) {
    const index = await deps.store.readIndex();
    const slug = topicToShare(args, index, deps.slot);
    const auth = await deps.pi.exec("gh", ["auth", "status"]).catch(() => undefined);
    if (auth?.code !== 0) throw new Error(GH_MISSING);
    const upload = { deps, slug, path: deps.store.topicPath(slug) };
    const existing = index.topics[slug]?.gist;
    const url = existing ? await updateGist(upload, existing) : await createGist(upload);
    await deps.store.updateIndex((current) => {
      const entry = current.topics[slug];
      const topics = entry
        ? { ...current.topics, [slug]: { ...entry, gist: url } }
        : current.topics;
      return { ...current, share_notice_shown: true, topics };
    });
    const notice = index.share_notice_shown ? [] : [`> ${UNLISTED_NOTICE}`];
    showCard(deps.pi, ctx, {
      title: `Shared ${slug}`,
      body: [existing ? `Updated ${url}` : `Created ${url}`, ...notice].join("\n\n"),
    });
  },
};

function topicToShare(args: string, index: LearnIndex, slot: RunSlot): string {
  const named = slugify(args);
  if (named !== "") {
    if (!index.topics[named]) throw new Error(`no topic named ${named}. Run /learn list`);
    return named;
  }
  const run = slot.current();
  if (!run) throw new Error("no learning session here. Use /learn share <topic> or /learn list");
  return run.slug;
}

// `gh gist create` makes a secret gist unless given --public, which would make it listed and searchable.
async function createGist({ deps, slug, path }: GistUpload): Promise<string> {
  const result = await deps.pi.exec("gh", [
    "gist",
    "create",
    path,
    "--desc",
    `pi-learn notes: ${slug}`,
  ]);
  const url = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("https://"));
  if (result.code !== 0 || url === undefined) {
    throw new Error(`gh gist create failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return url;
}

async function updateGist({ deps, slug, path }: GistUpload, url: string): Promise<string> {
  const result = await deps.pi.exec("gh", ["gist", "edit", url, "--filename", `${slug}.md`, path]);
  if (result.code !== 0) throw new Error(`gh gist edit failed: ${result.stderr.trim()}`);
  return url;
}
