import {
  MAX_DIAGRAM_COLUMNS,
  MAX_OBSERVATION_LENGTH,
  MAX_PROFILE_LINE_LENGTH,
  MAX_PROFILE_LINES,
  MAX_SLUG_LENGTH,
} from "./model";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

export function diagramProblem(diagram: string): string | undefined {
  if (diagram.includes("```")) return "send the diagram without ``` fences; pi-learn adds them";
  const wide = diagram
    .split("\n")
    .flatMap((line, i) => ([...line].length > MAX_DIAGRAM_COLUMNS ? [i + 1] : []));
  return wide.length === 0
    ? undefined
    : `diagram lines ${wide.join(", ")} are wider than ${MAX_DIAGRAM_COLUMNS} columns; redraw the diagram narrower`;
}

export function textProblem(field: string, text: string): string | undefined {
  const breaksLayout = text
    .split("\n")
    .some((line) => line.startsWith("## ") || line.startsWith("```"));
  return breaksLayout
    ? `${field} must not contain lines starting with "## " or "\`\`\`"`
    : undefined;
}

export function singleLineProblem(field: string, text: string): string | undefined {
  return text.trim() === "" || /[|\n]/.test(text)
    ? `${field} "${text}" must be one non-empty line with no "|"`
    : undefined;
}

/** Observations feed the promotion pass, so each is one short line, never a pasted block. */
export function observationProblem(note: string): string | undefined {
  const text = note.trim();
  if (text === "") return "note must not be empty";
  if (text.includes("\n")) return "note must be one line";
  const length = [...text].length;
  return length > MAX_OBSERVATION_LENGTH
    ? `note is ${length} characters and the cap is ${MAX_OBSERVATION_LENGTH}; shorten it`
    : undefined;
}

export function duplicateProblem(field: string, values: readonly string[]): string | undefined {
  const repeated = values.find((value, i) => values.indexOf(value) !== i);
  return repeated === undefined ? undefined : `${field} "${repeated}" appears twice`;
}

export function termProblem(term: string): string | undefined {
  return (
    singleLineProblem("term", term) ??
    (term.includes(",") ? `term "${term}" must not contain a comma` : undefined)
  );
}

const LAST_SEEN_MARKER = /<!-- last_seen: [1-9]\d* -->$/;

function profileLineProblem(line: string, number: number): string | undefined {
  const length = [...line].length;
  if (length > MAX_PROFILE_LINE_LENGTH) {
    return `profile line ${number} is ${length} characters and the cap is ${MAX_PROFILE_LINE_LENGTH}; shorten it`;
  }
  return LAST_SEEN_MARKER.test(line.trim())
    ? undefined
    : `profile line ${number} must end with <!-- last_seen: N -->, where N is the latest run that showed the pattern`;
}

export function profileProblem(profile: string): string | undefined {
  const lines = profile.split("\n");
  const count = lines.filter((line) => line.trim() !== "").length;
  if (count > MAX_PROFILE_LINES) {
    return `the profile has ${count} lines and the cap is ${MAX_PROFILE_LINES}; drop the weakest lines and send it again`;
  }
  return lines
    .map((line, i) => (line.trim() === "" ? undefined : profileLineProblem(line, i + 1)))
    .find((problem) => problem !== undefined);
}

/** Throws the first problem, so a tool can check several inputs in one call. */
export function assertValid(...problems: readonly (string | undefined)[]): void {
  const problem = problems.find((p) => p !== undefined);
  if (problem !== undefined) throw new Error(problem);
}
