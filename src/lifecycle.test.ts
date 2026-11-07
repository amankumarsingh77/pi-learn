import { afterEach, describe, expect, test } from "bun:test";
import { CODING_TOOLS, type SavedEntry } from "./testing/fake-pi";
import { type LoadedPiLearn, loadPiLearn, RUN_TOOLS } from "./testing/harness";

const runEntry = (slug: string | null): SavedEntry => ({
  customType: "pi-learn-run",
  data: { slug },
});

let learn: LoadedPiLearn;

afterEach(() => learn.cleanup());

/** pi-learn loaded into a session whose file already holds these entries, with topic x saved. */
async function reopenSession(entries: readonly SavedEntry[]): Promise<void> {
  learn = await loadPiLearn({ entries: [...entries] });
  await learn.store.createTopic("x", "X");
  await learn.store.updateTopic("x", (doc) => ({
    ...doc,
    goal: "explain x",
    nodes: [{ name: "first idea", depth: "must know", state: "◐" }],
  }));
}

describe("restoring a run on session_start", () => {
  test("SC26: a session whose last entry names topic x restores the run on x with every learn tool, a notice and x's map, but no kickoff and no new run count", async () => {
    await reopenSession([runEntry("x")]);

    await learn.fake.emit("session_start", { type: "session_start", reason: "resume" });
    const section = (await learn.promptSections()).pi_learn;

    expect(learn.fake.state.active).toEqual(RUN_TOOLS);
    expect(learn.fake.state.notices).toEqual([
      { type: "info", message: expect.stringContaining("back in your learn run on x") },
    ]);
    expect(section).toContain("Topic: x.");
    expect(section).toContain("| 1 | first idea | must know | ◐ |");
    expect(learn.fake.state.sent).toEqual([]);
    expect((await learn.store.readIndex()).runs).toBe(0);
  });

  test("SC27: a session whose entries are slug x then slug null stays stopped on reopen and shows no notice", async () => {
    await reopenSession([runEntry("x"), runEntry(null)]);

    await learn.fake.emit("session_start", { type: "session_start", reason: "resume" });

    expect(await learn.promptSections()).not.toHaveProperty("pi_learn");
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
    expect(learn.fake.state.notices).toEqual([]);
  });

  test("SC28: a session whose entry names topic x, which the index does not have, restores no run and switches no tool on", async () => {
    learn = await loadPiLearn({ entries: [runEntry("x")] });

    await learn.fake.emit("session_start", { type: "session_start", reason: "resume" });

    expect(await learn.promptSections()).not.toHaveProperty("pi_learn");
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
  });

  test("/new during an active run starts a session with no run entry, so the run, its tools and its prompt section are dropped", async () => {
    learn = await loadPiLearn();
    await learn.fake.command("/learn new x");
    learn.fake.state.entries.length = 0;

    await learn.fake.emit("session_start", { type: "session_start", reason: "new" });

    expect(await learn.promptSections()).not.toHaveProperty("pi_learn");
    expect(learn.fake.state.active).toEqual(CODING_TOOLS);
  });

  test("SC65: neither restoring a run on reopen nor /new during it tells the model a run ended", async () => {
    await reopenSession([runEntry("x")]);
    await learn.fake.emit("session_start", { type: "session_start", reason: "resume" });
    learn.fake.state.entries.length = 0;

    await learn.fake.emit("session_start", { type: "session_start", reason: "new" });

    expect(learn.fake.state.sent).toEqual([]);
  });
});
