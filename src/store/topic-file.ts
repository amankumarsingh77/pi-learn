import {
  DEPTHS,
  EMPTY_PITCH,
  isOneOf,
  type MapNode,
  NODE_STATES,
  TOPIC_STATUSES,
  type TopicDoc,
  type TopicStatus,
} from "../model";

export class TopicParseError extends Error {
  constructor(
    readonly line: number,
    reason: string,
  ) {
    super(`line ${line}: ${reason}`);
    this.name = "TopicParseError";
  }
}

export interface NodeContent {
  readonly explanation: string;
  readonly diagram: string;
  readonly learnerWords?: string | undefined;
  readonly trap?: string | undefined;
  readonly gap?: string | undefined;
  readonly sources: readonly string[];
}

const FENCE = "```";
const WORDS_PREFIX = "my words: ";
const TRAP_PREFIX = "the trap I fell into: ";
const GAP_PREFIX = "gap: ";
const SOURCES_PREFIX = "sources: ";
const FIELD_PREFIXES = [WORDS_PREFIX, TRAP_PREFIX, GAP_PREFIX, SOURCES_PREFIX];
const MAP_HEADING = "## Map";
const SKIPPED_HEADING = "## Skipped";
const NODE_HEADING = /^## (\d+)\. (.+?) {2}(\S+)$/;

export function emptyTopic(slug: string): TopicDoc {
  return {
    slug,
    goal: "",
    pitch: EMPTY_PITCH,
    status: "in-progress",
    nodes: [],
    sections: {},
    skipped: [],
  };
}

export function renderMapTable(nodes: readonly MapNode[]): string {
  const rows = nodes.map(
    (node, i) => `| ${i + 1} | ${node.name} | ${node.depth} | ${node.state} |`,
  );
  return ["| # | node | depth | state |", "|---|------|-------|-------|", ...rows].join("\n");
}

export function renderTopic(doc: TopicDoc): string {
  const front = [
    "---",
    `topic: ${doc.slug}`,
    `goal: ${doc.goal}`,
    `start-from: ${doc.pitch.startFrom}`,
    `assume: ${doc.pitch.assume.join(", ")}`,
    `define: ${doc.pitch.define.join(", ")}`,
    `status: ${doc.status}`,
    "---",
  ];
  const sections = doc.nodes.flatMap((node, i) => {
    const body = doc.sections[node.name];
    return body === undefined ? [] : [`## ${i + 1}. ${node.name}  ${node.state}\n${body}`];
  });
  const skipped =
    doc.skipped.length === 0
      ? []
      : [[SKIPPED_HEADING, ...doc.skipped.map((item) => `- ${item}`)].join("\n")];
  const blocks = [
    front.join("\n"),
    `${MAP_HEADING}\n${renderMapTable(doc.nodes)}`,
    ...sections,
    ...skipped,
  ];
  return `${blocks.join("\n\n")}\n`;
}

export function renderNodeBody(content: NodeContent): string {
  const oneLine = (text: string) => text.trim().replace(/\s*\n\s*/g, " ");
  const fields = [
    ...(content.learnerWords ? [`${WORDS_PREFIX}"${oneLine(content.learnerWords)}"`] : []),
    ...(content.trap ? [`${TRAP_PREFIX}${oneLine(content.trap)}`] : []),
    ...(content.gap ? [`${GAP_PREFIX}${oneLine(content.gap)}`] : []),
    ...(content.sources.length > 0 ? [`${SOURCES_PREFIX}${content.sources.join(", ")}`] : []),
  ];
  // A blank line between fields keeps Markdown from folding them into one paragraph.
  return [
    content.explanation.trim(),
    FENCE,
    content.diagram.replace(/\s+$/, ""),
    FENCE,
    ...(fields.length > 0 ? [fields.join("\n\n")] : []),
  ].join("\n");
}

export function gapOf(body: string): string | undefined {
  return body
    .split("\n")
    .find((line) => line.startsWith(GAP_PREFIX))
    ?.slice(GAP_PREFIX.length);
}

interface Block {
  readonly heading: string;
  readonly line: number;
  readonly body: string[];
}

export function parseTopic(text: string): TopicDoc {
  const lines = text.split("\n");
  if (lines[0] !== "---") throw new TopicParseError(1, "the file must start with a --- line");
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new TopicParseError(1, "the front matter is never closed with ---");
  const meta = parseFrontMatter(lines.slice(1, close));
  const blocks = splitBlocks(lines, close + 1);
  const mapBlock = blocks.find((block) => block.heading === MAP_HEADING);
  if (!mapBlock) throw new TopicParseError(close + 2, `no ${MAP_HEADING} section`);
  const nodes = parseMapRows(mapBlock);
  const sections = blocks.flatMap((block) => nodeSection(block, nodes));
  const skipped = blocks
    .filter((block) => block.heading === SKIPPED_HEADING)
    .flatMap((block) =>
      block.body.filter((line) => line.startsWith("- ")).map((line) => line.slice(2)),
    );
  return { ...meta, nodes, sections: Object.fromEntries(sections), skipped };
}

function parseFrontMatter(
  lines: readonly string[],
): Pick<TopicDoc, "slug" | "goal" | "pitch" | "status"> {
  const fields = new Map(
    lines.map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, Math.max(at, 0)).trim(), line.slice(at + 1).trim()] as const;
    }),
  );
  const slug = fields.get("topic");
  const status = fields.get("status") ?? "";
  if (!slug) throw new TopicParseError(2, "the front matter has no topic");
  if (!isOneOf<TopicStatus>(TOPIC_STATUSES, status)) {
    throw new TopicParseError(2, `status "${status}" is not in-progress or done`);
  }
  const terms = (key: string): string[] =>
    (fields.get(key) ?? "")
      .split(",")
      .map((term) => term.trim())
      .filter((term) => term !== "");
  const pitch = {
    startFrom: fields.get("start-from") ?? "",
    assume: terms("assume"),
    define: terms("define"),
  };
  return { slug, goal: fields.get("goal") ?? "", pitch, status };
}

function splitBlocks(lines: readonly string[], start: number): Block[] {
  const blocks: Block[] = [];
  let inFence = false;
  lines.slice(start).forEach((text, offset) => {
    const line = start + offset + 1;
    if (!inFence && text.startsWith("## ")) {
      blocks.push({ heading: text, line, body: [] });
      return;
    }
    if (text.startsWith(FENCE)) inFence = !inFence;
    const current = blocks.at(-1);
    if (current) current.body.push(text);
    else if (text.trim() !== "")
      throw new TopicParseError(line, "text before the first ## section");
  });
  return blocks;
}

function parseMapRows(block: Block): MapNode[] {
  return block.body.flatMap((text, i) => {
    const line = block.line + 1 + i;
    if (!text.startsWith("|")) return [];
    const cells = text
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [number = "", name = "", depth = "", state = ""] = cells;
    if (number === "#" || /^-+$/.test(number)) return [];
    if (cells.length !== 4 || name === "") {
      throw new TopicParseError(line, "a map row needs 4 cells: # | node | depth | state");
    }
    if (!isOneOf(DEPTHS, depth)) {
      throw new TopicParseError(line, `depth "${depth}" is not "must know" or "enough"`);
    }
    if (!isOneOf(NODE_STATES, state)) {
      throw new TopicParseError(line, `state "${state}" is not one of ${NODE_STATES.join(" ")}`);
    }
    return [{ name, depth, state }];
  });
}

function nodeSection(block: Block, nodes: readonly MapNode[]): [string, string][] {
  if (block.heading === MAP_HEADING || block.heading === SKIPPED_HEADING) return [];
  const name = NODE_HEADING.exec(block.heading)?.[2];
  if (name === undefined || !nodes.some((node) => node.name === name)) {
    throw new TopicParseError(block.line, `"${block.heading}" is not a node from the map`);
  }
  return [[name, separateFields(trimBlankLines(block.body)).join("\n")]];
}

const isField = (line: string | undefined): boolean =>
  line !== undefined && FIELD_PREFIXES.some((prefix) => line.startsWith(prefix));

/** Notes written before fields were split by blank lines get them on read (ADR 0001). */
function separateFields(lines: readonly string[]): readonly string[] {
  const diagramEnd = lines.findLastIndex((line) => line.startsWith(FENCE));
  return lines.flatMap((line, i) =>
    i > diagramEnd && isField(line) && isField(lines[i - 1]) ? ["", line] : [line],
  );
}

function trimBlankLines(lines: readonly string[]): readonly string[] {
  const first = lines.findIndex((line) => line.trim() !== "");
  const last = lines.findLastIndex((line) => line.trim() !== "");
  return first === -1 ? [] : lines.slice(first, last + 1);
}
