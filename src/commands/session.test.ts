import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CODING_TOOLS } from "../testing/fake-pi";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
});

afterEach(() => learn.cleanup());

/** An active run on http-round-trip with a 2-node map and one parked side topic. */
async function startMappedRun(): Promise<void> {
  await learn.fake.command("/learn new http round trip");
  await learn.learnerSays("a request goes out and a page comes back");
  await learn.fake.tool("learn_set_map", {
    goal: "explain an HTTP round trip",
    nodes: [
      { name: "DNS lookup", depth: "must know" },
      { name: "request format", depth: "must know" },
    ],
  });
  await learn.fake.tool("learn_add_side_topic", { title: "HTTP/2 framing", reason: "not asked" });
}

describe("/learn stop", () => {
  test("SC17: /learn stop on a mapped run prints map, parked topic and notes path, switches learn tools off and drops the prompt section", async () => {
    await startMappedRun();
    learn.fake.state.notices.length = 0;

    await learn.fake.command("/learn stop");
    const sections = await learn.promptSections({ pi_learn: "stale" });

    expect(learn.fake.state.notices).toEqual([]);
    const card = learn.cards().at(-1);
    expect(card?.title).toBe("Learn run on http-round-trip stopped");
    expect(card?.body).toContain(
      "| 1 | DNS lookup | must know | ○ |\n| 2 | request format | must know | ○ |",
    );
    expect(card?.body).toContain("- HTTP/2 framing (not asked)");
    expect(card?.body).toContain(learn.store.topicPath("http-round-trip"));
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
    const runEntries = learn.fake.state.entries.filter((e) => e.customType === "pi-learn-run");
    expect(runEntries.at(-1)).toEqual({ customType: "pi-learn-run", data: { slug: null } });
    expect(sections).not.toHaveProperty("pi_learn");
  });

  test("SC63: /learn stop tells the model, without starting a turn, that the run on http-round-trip ended and the next replies are normal coding help", async () => {
    await startMappedRun();
    learn.fake.state.sent.length = 0;

    await learn.fake.command("/learn stop");

    expect(learn.fake.state.sent).toEqual([
      {
        customType: "pi-learn-run-ended",
        content: expect.stringContaining("The learn run on http-round-trip has ended"),
        display: false,
        triggerTurn: false,
        deliverAs: undefined,
      },
    ]);
    expect(String(learn.fake.state.sent[0]?.content)).toContain("normal coding assistant");
  });

  test("SC18: /learn stop with no active run says no learning session is active and appends no session entry", async () => {
    await learn.fake.command("/learn stop");

    expect(learn.fake.state.notices).toEqual([
      { type: "info", message: expect.stringContaining("No learning session is active") },
    ]);
    expect(learn.fake.state.entries).toEqual([]);
  });
});

describe("/learn list", () => {
  test("SC25: /learn list shows the newer topic first with title, status and date, ends the older row with its gist, and points an empty dir at /learn new", async () => {
    await learn.fake.command("/learn list");
    expect(learn.cards().at(-1)).toEqual({
      title: "0 topics",
      body: expect.stringContaining("/learn new"),
    });

    await learn.store.updateIndex((index) => ({
      ...index,
      topics: {
        dns: {
          title: "DNS",
          file: "dns.md",
          status: "done",
          updated: "2026-10-01T09:00:00.000Z",
          gist: "https://gist.github.com/learner/abc123",
        },
        tls: {
          title: "TLS",
          file: "tls.md",
          status: "in-progress",
          updated: "2026-11-05T09:00:00.000Z",
        },
      },
    }));
    learn.fake.state.notices.length = 0;

    await learn.fake.command("/learn list");

    expect(learn.fake.state.notices).toEqual([]);
    expect(learn.cards().at(-1)).toEqual({
      title: "2 topics",
      body: expect.stringContaining(
        [
          "| Topic | Title | Status | Updated | Gist |",
          "| --- | --- | --- | --- | --- |",
          "| `tls` | TLS | in-progress | 2026-11-05 | – |",
          "| `dns` | DNS | done | 2026-10-01 | https://gist.github.com/learner/abc123 |",
        ].join("\n"),
      ),
    });
  });

  test("SC60: in Asia/Kolkata, a topic updated at 02:08 local on 7 Nov (20:38 UTC on 6 Nov) lists as updated 2026-11-07", async () => {
    const zone = process.env.TZ;
    process.env.TZ = "Asia/Kolkata";
    try {
      await learn.store.updateIndex((index) => ({
        ...index,
        topics: {
          dns: {
            title: "DNS",
            file: "dns.md",
            status: "done",
            updated: "2026-11-06T20:38:00.000Z",
          },
        },
      }));

      await learn.fake.command("/learn list");

      expect(learn.cards().at(-1)?.body).toContain("| `dns` | DNS | done | 2026-11-07 | – |");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });
});

describe("/learn profile", () => {
  test("SC37: /learn profile on an empty dir says there is no profile yet; with 2 lines it shows both and the profile.md path", async () => {
    await learn.fake.command("/learn profile");

    expect(learn.cards()).toEqual([
      { title: "Your learner profile", body: expect.stringContaining("No profile yet") },
    ]);

    const profile = [
      "answers before reading the whole question; lead with the constraint <!-- last_seen: 1 -->",
      "thinks in pictures; draw the diagram first <!-- last_seen: 1 -->",
    ].join("\n");
    await learn.store.writeProfile(profile);
    learn.fake.state.notices.length = 0;

    await learn.fake.command("/learn profile");

    expect(learn.fake.state.notices).toEqual([]);
    const card = learn.cards().at(-1);
    expect(card?.body).toContain(profile);
    expect(card?.body).toContain(learn.store.profilePath);
  });
});
