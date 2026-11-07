---
status: active
date: 2026-11-07
source: docs/superpowers/specs/2026-11-07-pi-learn-design.md
tags: [topic-file, learn-resume]
---

# The topic's Markdown notes file is the only record of its map and node state

## Context and Problem Statement

pi-learn keeps notes a learner can reread and share as a gist, and `/learn resume` must rebuild a topic's map, node states and gaps from something stored between runs.

## Considered Options

- `<topic>.md` as the only record of map and node state: front matter, a `## Map` table and `## N. name  state` node sections, parsed back on resume
- A JSON state file per topic, with the Markdown notes rendered from it

## Decision Outcome

Chosen: `<topic>.md` as the only record of map and node state, because the notes the learner reads, edits by hand and shares are then exactly what the agent resumes from, with no second file to drift out of sync.

## Consequences

A new per-node or per-topic field goes into the `<topic>.md` format and its parser, and a format change must keep existing notes files readable.

The format has extended once so far: a node section's field lines (`my words:`, `the trap I fell into:`, `gap:`, `sources:`) are now separated by a blank line, so Markdown and the shared gist show each as its own paragraph. The parser still reads notes that hold those lines on consecutive lines and adds the blank lines, so the next save writes the new layout.
