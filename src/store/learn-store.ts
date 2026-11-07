import { join } from "node:path";
import { errorMessage } from "../errors";
import { EMPTY_INDEX, type LearnIndex, type Observation, type TopicDoc } from "../model";
import { appendLine, readTextOr, writeAtomic } from "./fs";
import { emptyTopic, parseTopic, renderTopic } from "./topic-file";

export type Clock = () => string;

export interface LearnStore {
  readonly root: string;
  topicPath(slug: string): string;
  readIndex(): Promise<LearnIndex>;
  updateIndex(change: (index: LearnIndex) => LearnIndex): Promise<LearnIndex>;
  createTopic(slug: string, title: string): Promise<TopicDoc>;
  readTopic(slug: string): Promise<TopicDoc>;
  updateTopic(slug: string, change: (doc: TopicDoc) => TopicDoc): Promise<TopicDoc>;
  readonly profilePath: string;
  readProfile(): Promise<string>;
  writeProfile(profile: string): Promise<void>;
  appendObservation(observation: Observation): Promise<void>;
  /** Raw JSON lines of observations.jsonl, oldest first. */
  readObservations(): Promise<readonly string[]>;
}

export function createLearnStore(
  root: string,
  now: Clock = () => new Date().toISOString(),
): LearnStore {
  const indexPath = join(root, "index.json");
  const profilePath = join(root, "profile.md");
  const observationsPath = join(root, "observations.jsonl");
  const topicPath = (slug: string): string => join(root, `${slug}.md`);

  const readIndex = async (): Promise<LearnIndex> => parseIndex(await readTextOr(indexPath, "{}"));

  // pi runs a turn's tool calls in parallel, so every write goes through one queue: a
  // read-change-write must read only after the write before it has landed.
  let queue: Promise<unknown> = Promise.resolve();
  const serially = <T>(step: () => Promise<T>): Promise<T> => {
    const result = queue.then(step);
    queue = result.catch(() => undefined);
    return result;
  };

  const changeIndex = async (change: (index: LearnIndex) => LearnIndex): Promise<LearnIndex> => {
    const next = change(await readIndex());
    await writeAtomic(indexPath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  };

  const writeTopic = async (doc: TopicDoc, title?: string): Promise<TopicDoc> => {
    await writeAtomic(topicPath(doc.slug), renderTopic(doc));
    await changeIndex((index) => {
      const existing = index.topics[doc.slug];
      const entry = {
        ...existing,
        title: title ?? existing?.title ?? doc.slug,
        file: `${doc.slug}.md`,
        status: doc.status,
        updated: now(),
      };
      return { ...index, topics: { ...index.topics, [doc.slug]: entry } };
    });
    return doc;
  };

  const readTopic = async (slug: string): Promise<TopicDoc> => {
    const text = await readTextOr(topicPath(slug), "");
    if (text === "") throw new Error(`no notes file at ${topicPath(slug)}`);
    try {
      return parseTopic(text);
    } catch (error) {
      throw new Error(`cannot read ${topicPath(slug)}: ${errorMessage(error)}`);
    }
  };

  return {
    root,
    topicPath,
    readIndex,
    updateIndex: (change) => serially(() => changeIndex(change)),
    readTopic,
    createTopic: (slug, title) => serially(() => writeTopic(emptyTopic(slug), title)),
    updateTopic: (slug, change) => serially(async () => writeTopic(change(await readTopic(slug)))),
    profilePath,
    readProfile: () => readTextOr(profilePath, ""),
    writeProfile: (profile) => serially(() => writeAtomic(profilePath, `${profile.trim()}\n`)),
    appendObservation: (observation) =>
      serially(() => appendLine(observationsPath, JSON.stringify({ t: now(), ...observation }))),
    readObservations: async () =>
      (await readTextOr(observationsPath, "")).split("\n").filter((line) => line.trim() !== ""),
  };
}

function parseIndex(text: string): LearnIndex {
  try {
    return { ...EMPTY_INDEX, ...(JSON.parse(text) as Partial<LearnIndex>) };
  } catch (error) {
    throw new Error(`index.json is not valid JSON: ${errorMessage(error)}`);
  }
}
