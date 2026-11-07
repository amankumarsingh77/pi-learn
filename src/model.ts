export const NODE_STATES = ["○", "◐", "●", "✗"] as const;
export type NodeState = (typeof NODE_STATES)[number];

export const DEPTHS = ["must know", "enough"] as const;
export type Depth = (typeof DEPTHS)[number];

export const TOPIC_STATUSES = ["in-progress", "done"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const MAX_DIAGRAM_COLUMNS = 72;
/** Long enough for four or five sentences; longer reads as a wall of text on GitHub. */
export const MAX_PARAGRAPH_LENGTH = 600;
/** Keeps `<slug>.md` well under the 255-byte file-name limit of common filesystems. */
export const MAX_SLUG_LENGTH = 80;
export const MAX_PROFILE_LINES = 20;
export const MAX_PROFILE_LINE_LENGTH = 200;
/** An observation may become one profile line, so it obeys the same length cap. */
export const MAX_OBSERVATION_LENGTH = MAX_PROFILE_LINE_LENGTH;

export const OBSERVATION_KINDS = ["habit", "style", "prior-knowledge", "own-words"] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export interface Observation {
  readonly topic: string;
  readonly kind: ObservationKind;
  readonly note: string;
}

export interface MapNode {
  readonly name: string;
  readonly depth: Depth;
  readonly state: NodeState;
}

export interface Pitch {
  /** One plain sentence: where teaching starts for this learner. */
  readonly startFrom: string;
  /** Terms used without explanation. */
  readonly assume: readonly string[];
  /** Terms explained in one line on first use. */
  readonly define: readonly string[];
}

export const EMPTY_PITCH: Pitch = { startFrom: "", assume: [], define: [] };

export interface TopicDoc {
  readonly slug: string;
  readonly goal: string;
  readonly pitch: Pitch;
  readonly status: TopicStatus;
  readonly nodes: readonly MapNode[];
  /** Node section bodies keyed by node name. A node with no body has no section yet. */
  readonly sections: Readonly<Record<string, string>>;
  readonly skipped: readonly string[];
}

export interface IndexEntry {
  readonly title: string;
  readonly file: string;
  readonly status: TopicStatus;
  readonly updated: string;
  readonly gist?: string;
}

export interface LearnIndex {
  readonly runs: number;
  readonly observations_reviewed: number;
  readonly share_notice_shown: boolean;
  readonly topics: Readonly<Record<string, IndexEntry>>;
}

export const EMPTY_INDEX: LearnIndex = {
  runs: 0,
  observations_reviewed: 0,
  share_notice_shown: false,
  topics: {},
};

export const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

/** Index entries, most recently updated first. */
export const byRecency = (index: LearnIndex): [string, IndexEntry][] =>
  Object.entries(index.topics).sort(([, a], [, b]) => b.updated.localeCompare(a.updated));
