import type { LearnDeps } from "./deps";

/** The ways a tool call can spell the notes folder: as is, and from the home folder. */
export function notesPathForms(root: string, home: string): string[] {
  if (!root.startsWith(`${home}/`)) return [root];
  const rest = root.slice(home.length);
  return [root, `~${rest}`, `$HOME${rest}`, `\${HOME}${rest}`];
}

const BLOCKED_REASON =
  "pi-learn: the notes folder is off limits during a lesson. Everything you need is in the system prompt; save only through the learn_* tools.";

/**
 * Blocks a coding tool call that names the notes folder while a run is active. observations.jsonl
 * never enters the prompt on purpose, so a raw read would get around the profile gate. It matches
 * path text, so it stops an honest mistake, not a call built to get around it.
 */
export function guardNotesFolder(deps: LearnDeps, forms: readonly string[]) {
  return (event: { readonly toolName: string; readonly input: unknown }) => {
    if (!deps.slot.current() || deps.toolNames.includes(event.toolName)) return undefined;
    const input = JSON.stringify(event.input) ?? "";
    return forms.some((form) => input.includes(form))
      ? { block: true, reason: BLOCKED_REASON }
      : undefined;
  };
}
