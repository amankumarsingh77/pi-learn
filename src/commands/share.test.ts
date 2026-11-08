import { afterEach, beforeEach, expect, test } from "bun:test";
import { type LoadedPiLearn, loadPiLearn } from "../testing/harness";

const GIST_URL = "https://gist.github.com/u/abc";
const OK = { stdout: "", stderr: "", code: 0 };

let learn: LoadedPiLearn;

beforeEach(async () => {
  learn = await loadPiLearn();
});

afterEach(() => learn.cleanup());

test("SC38: the first /learn share dns runs gh gist create without --public, saves the URL and share_notice_shown, and warns the gist is unlisted", async () => {
  await learn.store.createTopic("dns", "DNS");
  learn.fake.state.execResults.push(OK, { ...OK, stdout: `${GIST_URL}\n` });

  await learn.fake.command("/learn share dns");

  const notesPath = learn.store.topicPath("dns");
  expect(learn.fake.state.execCalls).toEqual([
    ["gh", "auth", "status"],
    ["gh", "gist", "create", notesPath, "--desc", "pi-learn notes: dns"],
  ]);
  const index = await learn.store.readIndex();
  expect(index.topics.dns?.gist).toBe(GIST_URL);
  expect(index.share_notice_shown).toBe(true);
  expect(learn.fake.state.notices).toEqual([]);
  expect(learn.cards()).toEqual([
    {
      title: "Shared dns",
      body: expect.stringMatching(
        new RegExp(`Created ${GIST_URL}[\\s\\S]*unlisted, not access-controlled`),
      ),
    },
  ]);
});

test("SC39: a later /learn share dns runs gh gist edit on the stored URL, keeps the URL and drops the unlisted warning", async () => {
  await learn.store.createTopic("dns", "DNS");
  await learn.store.updateIndex((index) => ({
    ...index,
    share_notice_shown: true,
    topics: {
      ...index.topics,
      dns: { title: "DNS", file: "dns.md", status: "in-progress", updated: "", gist: GIST_URL },
    },
  }));
  learn.fake.state.execResults.push(OK, OK);

  await learn.fake.command("/learn share dns");

  expect(learn.fake.state.execCalls).toEqual([
    ["gh", "auth", "status"],
    ["gh", "gist", "edit", GIST_URL, "--filename", "dns.md", learn.store.topicPath("dns")],
  ]);
  expect((await learn.store.readIndex()).topics.dns?.gist).toBe(GIST_URL);
  expect(learn.fake.state.notices).toEqual([]);
  expect(learn.cards()).toEqual([{ title: "Shared dns", body: `Updated ${GIST_URL}` }]);
});

test("SC40: /learn share with no topic during a run on dns uploads dns.md", async () => {
  await learn.fake.command("/learn new dns");
  learn.fake.state.execResults.push(OK, { ...OK, stdout: GIST_URL });

  await learn.fake.command("/learn share");

  expect(learn.fake.state.execCalls.at(-1)).toEqual([
    "gh",
    "gist",
    "create",
    learn.store.topicPath("dns"),
    "--desc",
    "pi-learn notes: dns",
  ]);
});

test.each([
  ["SC41", "/learn share", "no learning session here. Use /learn share <topic> or /learn list"],
  ["SC42", "/learn share tls", "no topic named tls. Run /learn list"],
])("%s: %s errors with %p and never calls gh", async (_id, line, message) => {
  await learn.fake.command(line);

  expect(learn.fake.state.notices).toEqual([{ type: "error", message: `pi-learn: ${message}` }]);
  expect(learn.fake.state.execCalls).toEqual([]);
});

test("SC43: when gh auth status exits 1, /learn share dns prints the gh install line, runs no gist command and leaves index.json unchanged", async () => {
  await learn.store.createTopic("dns", "DNS");
  const before = await learn.readText("index.json");
  learn.fake.state.execResults.push({ ...OK, code: 1 });

  await learn.fake.command("/learn share dns");

  const [notice] = learn.fake.state.notices;
  expect(notice?.type).toBe("error");
  expect(notice?.message).toContain("https://cli.github.com");
  expect(notice?.message).toContain("gh auth login");
  expect(learn.fake.state.execCalls).toEqual([["gh", "auth", "status"]]);
  expect(await learn.readText("index.json")).toBe(before);
});

test("SC44: when gh gist create exits 1 with HTTP 422, /learn share dns shows the stderr and saves no gist", async () => {
  await learn.store.createTopic("dns", "DNS");
  learn.fake.state.execResults.push(OK, { stdout: "", stderr: "HTTP 422\n", code: 1 });

  await learn.fake.command("/learn share dns");

  expect(learn.fake.state.notices).toEqual([
    { type: "error", message: expect.stringContaining("HTTP 422") },
  ]);
  expect((await learn.store.readIndex()).topics.dns?.gist).toBeUndefined();
});
