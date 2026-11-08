import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdir, writeFile } from "node:fs/promises";
import { CODING_TOOLS } from "../testing/fake-pi";
import { type LoadedPiLearn, loadPiLearn, RUN_TOOLS } from "../testing/harness";

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
});

afterEach(() => learn.cleanup());

describe("/learn new", () => {
  test("SC3: /learn new HTTP round trip in an empty dir creates the notes, counts the run, activates the learn tools and sends the kickoff", async () => {
    await learn.fake.command("/learn new HTTP round trip");

    const notes = await learn.readText("http-round-trip.md");
    expect(notes).toContain("topic: http-round-trip");
    expect(notes).toContain("status: in-progress");
    expect(notes).toContain("## Map\n| # | node | depth | state |\n|---|------|-------|-------|\n");
    const index = await learn.store.readIndex();
    expect(index.runs).toBe(1);
    expect(index.topics["http-round-trip"]?.title).toBe("HTTP round trip");
    expect(learn.fake.state.active).toEqual(RUN_TOOLS);
    expect(learn.fake.state.sent).toHaveLength(1);
    const [kickoff] = learn.fake.state.sent;
    expect(kickoff?.triggerTurn).toBe(true);
    expect(String(kickoff?.content)).toContain("Start a new learn run");
    expect(String(kickoff?.content)).toContain("no earlier topics");
  });

  test("SC59: /learn new with a long question title starts a run under a four-word id without the filler words, keeps the full title, shows the id in a card, and /learn resume with the same title finds it", async () => {
    const title =
      "How does a CDN work for video streaming, and what are the different types of it?";
    const slug = "cdn-work-video-streaming";

    await learn.fake.command(`/learn new ${title}`);

    expect((await learn.store.readIndex()).topics[slug]?.title).toBe(title);
    expect(await learn.readText(`${slug}.md`)).toContain(`topic: ${slug}`);
    expect(learn.cards()).toEqual([
      { title: `New topic: ${slug}`, body: expect.stringContaining(`/learn resume ${slug}`) },
    ]);

    await learn.fake.command("/learn stop");
    await learn.fake.command(`/learn resume ${title}`);

    const kickoffs = learn.fake.state.sent.filter((sent) => sent.customType === "pi-learn-kickoff");
    expect(kickoffs).toHaveLength(2);
  });

  test("SC4: /learn new on an existing topic names /learn resume, leaves its notes byte-for-byte and starts no run", async () => {
    await seedTopic(learn, "http-round-trip", "HTTP round trip");
    const before = await learn.readText("http-round-trip.md");

    await learn.fake.command("/learn new http round trip");

    expect(learn.fake.state.notices).toEqual([
      expect.objectContaining({
        type: "error",
        message: expect.stringContaining("/learn resume http-round-trip"),
      }),
    ]);
    expect(await learn.readText("http-round-trip.md")).toBe(before);
    expect(learn.fake.state.sent).toEqual([]);
    expect(learn.fake.state.active).not.toContain("learn_set_map");
    expect((await learn.store.readIndex()).runs).toBe(1);
  });

  test("SC5: /learn new tls while a run on dns is active says to /learn stop first and creates no tls.md", async () => {
    await learn.fake.command("/learn new dns");

    await learn.fake.command("/learn new tls");

    expect(learn.fake.state.notices.at(-1)).toEqual({
      type: "error",
      message: expect.stringContaining("/learn stop first"),
    });
    expect(await readdir(learn.root)).not.toContain("tls.md");
  });

  test("SC13: /learn new web servers lists the earlier topic's slug, title, goal and map in the kickoff and drops the first-run note", async () => {
    await seedTopic(learn, "http-round-trip", "HTTP round trip");

    await learn.fake.command("/learn new web servers");

    const kickoff = String(learn.fake.state.sent.at(-1)?.content);
    expect(kickoff).toContain("- http-round-trip (in-progress): HTTP round trip");
    expect(kickoff).toContain(`Goal: ${SEED_GOAL}`);
    expect(kickoff).toContain("| 3 | keep-alive | enough | ○ |");
    expect((await learn.store.readIndex()).runs).toBe(2);
    const sections = await learn.promptSections();
    expect(sections.pi_learn).toContain("Topic: web-servers.");
    expect(sections.pi_learn).not.toContain("first run ever");
  });

  test("SC50: /learn new web servers after http-round-trip assumed URL, DNS, status codes says so on that topic's kickoff line", async () => {
    await seedTopic(learn, "http-round-trip", "HTTP round trip");
    await learn.store.updateTopic("http-round-trip", (doc) => ({
      ...doc,
      pitch: { ...doc.pitch, assume: ["URL", "DNS", "status codes"] },
    }));

    await learn.fake.command("/learn new web servers");

    const kickoff = String(learn.fake.state.sent.at(-1)?.content);
    const line = kickoff.split("\n").find((text) => text.startsWith("- http-round-trip "));
    expect(line).toContain("Already assumed: URL, DNS, status codes");
  });

  test("SC35:/learn new dns with no profile and no observations tells the model to skip the promotion pass and carries none of its rules", async () => {
    await learn.fake.command("/learn new dns");

    const kickoff = String(learn.fake.state.sent.at(-1)?.content);
    expect(kickoff).toContain("skip the promotion pass");
    expect(kickoff).not.toContain("learn_set_profile");
    expect(kickoff).not.toContain("last_seen");
  });

  test("SC79: with an observation pending, the kickoff tells the model to call learn_set_profile only when a line changes and to wait for agreement on the map before teaching", async () => {
    await learn.store.appendObservation({ topic: "http", kind: "habit", note: "skips a step" });

    await learn.fake.command("/learn new dns");

    const kickoff = String(learn.fake.state.sent.at(-1)?.content);
    expect(kickoff).toContain("do not call learn_set_profile");
    expect(kickoff).toContain("end your turn");
  });
});

describe("/learn resume", () => {
  test("SC22: /learn resume on a stopped topic with node 2 ◐ continues at node 2, puts the map and its gap in the prompt and records the run", async () => {
    await seedTopic(learn, "http-round-trip", "HTTP round trip");

    await learn.fake.command("/learn resume http-round-trip");

    expect(learn.fake.state.sent).toHaveLength(1);
    expect(String(learn.fake.state.sent[0]?.content)).toContain(
      "Continue at node 2 (request format).",
    );
    const section = (await learn.promptSections()).pi_learn;
    expect(section).toContain("| 2 | request format | must know | ◐ |");
    expect(section).toContain(`- 2. request format (◐): ${SEED_GAP}`);
    expect((await learn.store.readIndex()).runs).toBe(2);
    expect(learn.fake.state.entries.at(-1)).toEqual({
      customType: "pi-learn-run",
      data: { slug: "http-round-trip" },
    });
    expect(learn.fake.state.active).toEqual(RUN_TOOLS);
  });

  test("SC23: /learn resume tls with no tls in the index says no topic named tls, points at /learn list and starts no run", async () => {
    await learn.fake.command("/learn resume tls");

    expect(learn.fake.state.notices).toEqual([
      { type: "error", message: expect.stringContaining("no topic named tls; run /learn list") },
    ]);
    expectNoRun();
  });

  test("SC24: /learn resume on notes whose map row 1 depth was hand-edited to deep names the file and the row's line, starts no run and leaves the file unchanged", async () => {
    await seedTopic(learn, "http-round-trip", "HTTP round trip");
    const edited = (await learn.readText("http-round-trip.md")).replace(
      "| 1 | DNS lookup | must know | ● |",
      "| 1 | DNS lookup | deep | ● |",
    );
    await writeFile(learn.store.topicPath("http-round-trip"), edited);
    const rowLine = edited.split("\n").indexOf("| 1 | DNS lookup | deep | ● |") + 1;

    await learn.fake.command("/learn resume http-round-trip");

    expect(learn.fake.state.notices).toEqual([
      {
        type: "error",
        message: expect.stringContaining(
          `${learn.store.topicPath("http-round-trip")}: line ${rowLine}:`,
        ),
      },
    ]);
    expectNoRun();
    expect(await learn.readText("http-round-trip.md")).toBe(edited);
  });
});

/** Nothing a run start leaves behind: no kickoff, no session entry, no learn tool. */
function expectNoRun(): void {
  expect(learn.fake.state.sent).toEqual([]);
  expect(learn.fake.state.entries).toEqual([]);
  expect(learn.fake.state.active).toEqual(CODING_TOOLS);
}

const SEED_GOAL = "explain what happens between typing a URL and seeing the page";
const SEED_GAP = "thinks headers come after the body";

/** A topic left by an earlier run: a 3-node map with a gap on node 2, and its one run counted. */
async function seedTopic(learn: LoadedPiLearn, slug: string, title: string): Promise<void> {
  await learn.store.createTopic(slug, title);
  await learn.store.updateTopic(slug, (doc) => ({
    ...doc,
    goal: SEED_GOAL,
    nodes: [
      { name: "DNS lookup", depth: "must know", state: "●" },
      { name: "request format", depth: "must know", state: "◐" },
      { name: "keep-alive", depth: "enough", state: "○" },
    ],
    sections: { "request format": `A request is a start line, then headers.\ngap: ${SEED_GAP}` },
  }));
  await learn.store.updateIndex((index) => ({ ...index, runs: index.runs + 1 }));
}
