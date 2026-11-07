# pi-learn: a teaching extension for the pi coding agent

Date: 2026-11-07
Status: awaiting approval

## Intent

A pi extension that helps a person learn any topic. The agent explains in
simple, direct words, draws an ASCII diagram for every flow, asks a
question, and then reads the learner's raw typed thoughts to work out not
just whether the answer was right but whether the reasoning behind it was.

The core bet: a final answer hides the reasoning. Right answer with wrong
reasoning looks the same as right answer with right reasoning. The only way
to tell them apart is to have the learner type what they are thinking,
half-formed, and let the agent read that.

## Goals

- Teach any topic through an explain, ask, listen, diagnose loop.
- Every flow is shown as an ASCII diagram. No exceptions.
- Diagnose answer and reasoning separately. Right-for-the-wrong-reason is
  caught and corrected.
- Stay on the learner's actual question. Go deep only where the learner
  shows a gap.
- Produce running notes the learner can reread and share without opening pi.
- Learn the learner over time, without bloating context.

## Non-goals

- Not a quiz app with fixed question banks.
- Not a replacement for pi's own session store. Pi still records the chat.
- Not multi-user. One learner per machine.
- No spaced repetition engine in v1. A `/learn revise` command is named
  but deferred.

## Anti-goals (what makes this a failure even if it works)

- The agent explains in jargon or long prose.
- The agent goes depth-first into a sub-topic the learner never asked for.
- The agent judges spelling or grammar in the learner's raw text.
- The agent guesses a verdict from a two-word answer.
- The profile file grows until it eats the context window.
- The agent teaches something false.

## Decisions made with the user

These are the user's calls, as made in conversation.

1. **Model-driven loop.** The model runs the teaching loop from a system
   prompt. The extension owns the files through tools the model calls. The
   map and state table are the guardrail against drift.
2. **All tools stay on during a learn run.** Read, write, bash, and any
   lookup tools remain available. The system prompt instructs the agent to
   use write access only for throwaway scripts that prove or check
   something, never for persistent files. The notes file is the only
   persistent thing the extension writes.
3. **The agent must be truthful.** It has access to documentation and web
   lookup tools during a run and is instructed to fact-check before teaching.
   Sources go into the notes.
4. **The learner cannot override node state.** There is no
   `/learn mark` command. The learner's job is to type raw thoughts. Working
   out whether they were guessing, unsure, or reasoning wrongly is the
   agent's job.
5. **Calibration before the map, per new topic.** Before building the map
   the agent asks what the learner already knows. It also reads the index and
   notes of earlier topics so a later topic (say, web servers) can build on
   an earlier one (HTTP round-trip) instead of re-teaching it.
6. **Thin answers get no verdict.** On "idk", "yes", "the second one", the
   agent asks for the thinking rather than scoring.
7. **`/learn revise`** is the name for the future spaced-repetition
   command. Deferred.
8. **`/learn share [topic]`** takes an optional topic. Without one it shares
   the active run in this pi session. If no run is active, it says so.
9. **Notes live globally** under the home directory, not per project.
   Learning topics are not tied to a codebase.
10. **Profile is capped at 20 lines.** Observations are evidence and never
    enter context. Only promoted profile lines do.
11. **Fact-checking uses whatever lookup tools already exist.** The
    extension ships no fetch or search tool. At the start of a run it
    looks at the active tools and MCP servers for anything that can search
    or fetch (context7, web search, browser tools, and the like) and names
    them in the teaching prompt. If none is found, it warns the learner
    once that claims cannot be verified, and continues.
12. **A learn run takes over the pi session.** While a run is active every
    message is treated as part of the lesson. `/learn stop` (or the model
    calling `learn_pause` when the learner says they are done) saves node
    states, prints the map, detaches the teaching prompt, and adds a
    hidden note to the conversation saying the lesson is over, so pi
    returns to normal coding use: the chat still holds the lesson, and
    without the note the model keeps asking its last question.

## The teaching loop

```
  ┌─────────────────────────────────────────────┐
  │ 0. CALIBRATE   "what do you already know     │
  │                 about X, even if wrong?"     │
  │                 + read index of past topics  │
  └───────────────────────┬─────────────────────┘
                          ▼
  ┌─────────────────────────────────────────────┐
  │ 1. MAP         goal check + node list with   │
  │                depth per node, plus a one-   │
  │                line pitch. Learner edits and │
  │                agrees to both first.         │
  └───────────────────────┬─────────────────────┘
                          ▼
  ┌─────────────────────────────────────────────┐
  │ 2. EXPLAIN     simple words + ASCII diagram  │
  └───────────────────────┬─────────────────────┘
                          ▼
  ┌─────────────────────────────────────────────┐
  │ 3. ASK         one question on the node      │
  └───────────────────────┬─────────────────────┘
                          ▼
  ┌─────────────────────────────────────────────┐
  │ 4. LISTEN      learner types raw thoughts    │
  │                thin text -> ask for thinking │
  └───────────────────────┬─────────────────────┘
                          ▼
  ┌─────────────────────────────────────────────┐
  │ 5. DIAGNOSE    answer x reasoning matrix     │
  │                set node state, write notes,  │
  │                maybe append an observation   │
  └───────────────────────┬─────────────────────┘
                          ▼
          all must-know nodes ●?  ── no ──▶ back to 2
                          │                 (next ○ or ◐,
                         yes                 deeper only
                          ▼                  on a gap)
  ┌─────────────────────────────────────────────┐
  │ 6. FINAL CHECK one question spanning all     │
  │                nodes. Pass -> done.          │
  │                Fail -> broken node to ◐.     │
  └─────────────────────────────────────────────┘
```

### Diagnose matrix

| answer | reasoning | what the agent does |
|--------|-----------|---------------------|
| right  | right     | confirm, mark ●, move on |
| right  | wrong     | say so plainly, fix the mental model, mark ◐ |
| wrong  | partly ok | find the exact step where it broke, re-explain that step |
| wrong  | wrong     | re-explain from the missing foundation, mark ✗ |
| thin   | unknown   | no verdict. Ask for the thinking. |

Diagnose ignores grammar, spelling, and phrasing entirely. Only the
reasoning is judged.

### Node states

```
  ○ untouched   ◐ shaky (right answer, wrong reason)
  ● solid       ✗ wrong
```

### Depth rule

Breadth-first across the map. Go one level deeper on a node only when the
learner's raw text shows a gap there. Before every deeper step the agent
checks: does this help answer the original goal? If not, it is a side topic,
noted and offered at the end.

### Pitch

The agent pitches each topic to what the learner already knows, judged
from evidence, never set by the learner. At calibration it reads the raw
answer and decides where teaching starts, which terms it uses freely and
which it defines on first use. It shows that pitch in one plain sentence
beside the map, so both get one "OK?". It saves the pitch in the topic's
front matter (`start-from`, `assume`, `define`) and updates it through
`learn_set_pitch` when the learner uses a term correctly, misuses one,
asks "what's X?", or says "too basic" or "too much". A later topic's
calibration sees the terms earlier topics already assume. The pitch
changes how much is explained, never the teacher voice.

### Prerequisite mid-run

Small ("what is a port?"): explain inline in two lines. Big: give the
one-line version, add it as a side topic, keep going. Offered at the end
with the skipped nodes.

### Terminal state

The run ends when every must-know node is ● and the final check passes, or
when the learner says stop. In both cases the agent prints the map with
current states, the side topics it parked, and the path to the notes file.
On finish, the parked side topics are offered as the next topic.
Stop, pause and finish all add the same hidden "the lesson is over" note,
which starts no turn. It is appended at once rather than queued for the
next turn, so it never lands after the kickoff of a run started before the
learner's next message.

## Files

```
  ~/.pi/learn/
  ├── index.json            topic list, states, gist URLs
  ├── profile.md            <= 20 lines, loaded every run
  ├── observations.jsonl    append-only evidence, never loaded
  └── <topic>.md            one per topic
```

`<topic>` is the topic's slug: its title in lowercase letters, digits
and dashes, cut to 80 characters so the file name stays within
filesystem limits. `index.json` keeps the full title.

### `<topic>.md`

Carries its own state. Human readable, machine parseable.

```
  ---
  topic: http-round-trip
  goal: how a request goes client -> server -> back
  start-from: browser side known, server side new
  assume: URL, browser, DNS
  define: request headers, routing, status codes
  status: in-progress
  ---

  ## Map
  | # | node            | depth     | state |
  |---|-----------------|-----------|-------|
  | 1 | request format  | must know | ●     |
  | 2 | DNS + TCP       | enough    | ●     |
  | 3 | server handling | must know | ◐     |
  | 4 | response        | must know | ○     |

  ## 3. server handling  ◐
  <explanation, rewritten each pass so it holds the CORRECT model>
  ```
  <ascii diagram, always fenced, max 72 columns>
  ```
  my words: "the server just runs the code?"

  gap: didn't know about routing before the handler

  sources: <links used to fact-check>

  ## Skipped
  - HTTP/2 framing (not asked)
  - ports (parked prerequisite)
```

Node sections are rewritten, not appended. The final text holds the correct
model, with the learner's own wrong turn kept as "the trap I fell into".
The learner's own words are stored for every node, including ● ones, not
only the shaky ones. That is what makes the notes theirs. A blank line
separates the field lines after the diagram, so Markdown and the shared
gist show each as its own paragraph; notes that hold them on consecutive
lines still parse.

### `index.json`

```
  {
    "runs": 4,
    "observations_reviewed": 12,
    "share_notice_shown": true,
    "topics": {
      "http-round-trip": {
        "title": "HTTP round-trip",
        "file": "http-round-trip.md",
        "status": "in-progress",
        "updated": "2026-11-06T10:21Z",
        "gist": "https://gist.github.com/..."
      }
    }
  }
```

Topics sit under `topics`, so a topic named `runs` cannot collide with
the counters beside it: `runs`, the run counter used for profile decay;
`observations_reviewed`, the line count of observations.jsonl at the
last promotion pass, so the next pass knows where to start; and
`share_notice_shown`, so the unlisted-gist warning shows only once.

### `profile.md` and `observations.jsonl`

Two layers. Only one enters context.

```
  during a run                        at /learn new
  ────────────                        ─────────────
  diagnose notices a habit            read observations since
         │                            last promotion
         ▼                                   │
  append one line to                         ▼
  observations.jsonl                  promote / demote / decay
  {"t":..., "topic":...,              rewrite profile.md
   "kind":"habit",
   "note":"skipped the step
    where data moves between
    layers"}
```

Promotion rule: seen once is noise. Seen three times across two or more
topics becomes a profile line. Not seen for five runs, the line decays out.

Each profile line is a pattern plus what to do about it. A note the agent
cannot act on does not get in.

```
  bad:   "user is smart"
  bad:   "got question 3 wrong on 2026-11-06"
  good:  "answers before reading the whole question;
          put the key constraint in the first sentence"
  good:  "learns faster from a broken example than a
          definition; show the failure first"
  good:  "knows Python well; use it for analogies"
```

Four kinds of observation only: reasoning habits, which explanation style
lands, prior knowledge, and the learner's own words for things.
Each observation is one line of at most 200 characters, the same cap as
a profile line it may become, so a block of text the model read in a
lesson cannot be pasted into observations and ride into the promotion
pass.

Hard cap: 20 lines. Adding line 21 means dropping the weakest. The learner
may edit profile.md by hand and delete anything wrong.

The model writes profile.md, and every later run puts it in the system
prompt, so a line the model was talked into saving would persist across
sessions. Three checks keep that in bounds.

The prompt frames the profile as notes on how this learner learns. They
shape how the model teaches and are not instructions: it never runs a
tool, changes a file or changes its rules because a profile line says
so. The promotion pass labels the current profile and the unreviewed
observations the same way, as the learner's notes and as data.

`learn_set_profile` works only during the promotion pass of a run
started by `/learn new`, and only once per run. The pass closes when
the profile is saved, when any other `learn_*` tool runs, or when the
run's first turn ends, whichever comes first; code closes it, not the
model. A resumed or restored run, a `/learn new` with nothing to
promote, a second call and a call after the pass has closed are all
refused, and profile.md is left as it was.

Every non-blank profile line must end with `<!-- last_seen: N -->`,
where N is a positive run number, and be at most 200 characters. A write
that breaks this is refused with the line number and what is wrong.

## Commands

```
  /learn new <topic>        calibrate, map, get yes, teach
  /learn resume <topic>     rebuild map from notes, continue at first ◐ or ○
  /learn list               topics + states from index.json, each
                            with its last update as a local date
  /learn profile            print profile.md
  /learn share [topic]      upload <topic>.md to a private gist
  /learn stop               save states, print map, detach teaching prompt
  /learn revise             DEFERRED. re-ask ● nodes from old topics.
```

### `/learn share` resolution

```
  topic given? ──yes──▶ in index? ──yes──▶ upload
        │                   no ──▶ "no topic named X. run /learn list"
        no
        ▼
  run active in this pi session?
        │
   yes ─┼─ no ──▶ "no learning session here.
        │          /learn share <topic> or /learn list"
        ▼
  upload active topic
```

Uses `gh gist create` for the first share and updates the same gist on
later shares so the link stays stable. The gist URL is written to
index.json. If `gh` is missing or logged out, say so with the install line.
`profile.md` and `observations.jsonl` are never shared.

Gists render `.md` files, so the notes are readable in a browser. Every
ASCII diagram must sit inside a fenced code block or markdown collapses it.
A private gist is unlisted, not access-controlled: anyone with the link can
read it. The share command says this once, the first time it is used.

### One run per pi session

`/learn new` or `/learn resume` while a run is already active refuses and
says to `/learn stop` first. Nothing is lost; the active run's states are
already in its topic file.

### `/learn resume`

Reads index.json, parses the topic file's header and map table, and injects
into the system prompt: the goal, the map with states, and the gap text of
every ◐ and ✗ node. It does not replay the old chat. The notes are the
compressed state.

## What enters context

```
  system prompt
  ├── teaching rules          fixed text
  ├── profile.md              <= 20 lines
  ├── this topic's map        from <topic>.md
  └── gaps on ◐ ✗ nodes       from <topic>.md
  observations.jsonl          never
  other topics' full notes    never; only index entries
                              and their map tables when
                              calibrating a new topic
```

## Pi extension surface (how it gets made)

Language and platform: TypeScript, a pi extension. Confirmed against pi's
extension docs:

- `pi.registerCommand("learn", ...)` for the slash command, with
  sub-command parsing on `args`.
- `pi.registerTool(...)` for file-owning tools the model calls:
  - `learn_set_map` writes the map table after the learner agrees to it
  - `learn_set_pitch` saves the topic's pitch (`start-from`, `assume`,
    `define`) and updates it as the learner's words show more
  - `learn_set_node` sets a node's state and rewrites its section
  - `learn_add_side_topic` records a skipped or parked topic
  - `learn_observe` appends one line to observations.jsonl
  - `learn_finish` marks the topic done
  - `learn_pause` same as `/learn stop`, for when the learner says stop
  - `learn_set_profile` rewrites profile.md (called only during the
    promotion pass in the first turn of `/learn new`, before any
    other `learn_*` tool)
- `pi.on("before_agent_start", ...)` to inject the teaching rules,
  profile, and current map into the system prompt while a run is active.
- Active-run state lives in extension memory for the pi session and is
  recoverable from the topic file. The active topic is also recorded as
  a pi session entry (`pi.appendEntry`), so reopening the session with
  `pi --resume` restores the run.

The extension does not disable any built-in tools.

## Fixed rules in the teaching prompt

- Simple, direct words. Short sentences. Define a term in one line the
  first time it is used, unless the pitch says to assume it.
- Sound like a good teacher talking to one person: warm, plain, direct.
  No filler ("Great question!", "Let's dive in"), no hype words, no wall
  of bullets where two sentences will do. The pitch changes how much is
  explained, never this voice.
- Every flow gets an ASCII diagram, fenced, max 72 columns. If a line
  exceeds width, redraw.
- Ask one question at a time.
- Never score a thin answer. Ask for the thinking.
- Judge reasoning only. Never comment on grammar, spelling, or phrasing.
- Fact-check with docs or web tools before teaching a claim. Put sources in
  the notes.
- Write access is for throwaway scripts only. Nothing persistent except
  through the learn tools.
- Before going deeper on a node, ask whether it serves the original goal.
- First run ever: explain once why typing the messy thinking matters.

## Left to the builder

- Exact TypeScript layout, parsing of the markdown header and map table.
- How active-run state is held in the extension between turns.
- Wording of the teaching prompt beyond the fixed rules above.
- How the 72-column check is enforced (post-check on tool input is fine).
- Width-aware rendering in the pi terminal, if any.
- Test strategy. Scripted learner personas (the guesser, the one who
  already knows it, the two-word answerer) are the suggested eval shape.

## Calls made after the builder check

These are my calls, not the user's. Each could be changed without
reshaping the build.

- **Profile promotion is done by the model, not code.** At the start of
  `/learn new`, the extension hands the model every observation not yet
  reviewed plus the current profile.md. The model decides what repeats
  and writes the new profile through `learn_set_profile`. The extension
  enforces the 20-line cap by rejecting a longer write. A "run" for decay
  is any `/learn new` or `/learn resume`; a run counter lives in
  index.json under a top-level `runs` field, and each profile line
  carries a hidden `last_seen` run number in an HTML comment.
- **A learn run survives a pi restart only through `pi --resume`.**
  (Changed at design review; this was "does not survive".) Reopening the
  same session restores its run. A fresh `pi` or `/new` starts with no
  run: the learner types `/learn resume <topic>`, and `/learn share`
  without a topic says no session is active. Several topics may be
  in-progress at once; only one is active in a pi session.
- **Calibration context is injected by the extension, not read by the
  model.** It injects every topic's title, goal, and status, plus the map
  tables of the ten most recently updated topics. The teaching prompt
  tells the model not to read the learn directory with file tools.
- **`/learn new` on an existing topic refuses** and points at
  `/learn resume <topic>`. Notes are never overwritten by a new run. A
  learner who wants to start over deletes the file by hand.
- **`learn_set_node` takes structured fields**: state, explanation,
  diagram, learner words, gap, sources. The extension lays out the
  section, fences the diagram, and rejects any diagram line over 72
  columns so the model redraws. Each source must be one line with no `|`,
  so a source cannot forge a heading or a map row in the notes. The model calls it once at EXPLAIN with
  state ○ so the explanation lands in the file even if the learner stops
  before answering, and again at DIAGNOSE with the verdict.

## Example session, condensed

What the learner sees on the left, what the extension does on the right.
The builder should be able to trace every tool call here to the surface
above.

```
> /learn new http round trip          slug, index check, lookup tools
                                      found, promotion pass, inject prompt
agent: first-run note on typing raw
  thoughts. "what do you already
  know?"
> browser sends something, gets html
  back, DNS turns name to number,
  no idea about the server            CALIBRATE: gap at server side
agent: shows map (4 nodes, depth
  each, 2 skipped). "OK?"
> add tls
agent: added as node 5               learn_set_map -> file + index

agent: node 1 explain + diagram       lookup first; learn_set_node(1, ○)
agent: one question
> path is /cats/3, site is Host
  header I guess, but why send it
  again, the url had it               DIAGNOSE: right, right
                                      learn_set_node(1, ●, my words)
                                      learn_observe(habit: asks why)
agent: confirms, answers the why.
  node 2 short (depth: enough)        learn_set_node(2, ○)
> port. no idea what picks 443        right; small prereq -> inline
                                      learn_set_node(2, ●)
agent: node 3 explain + diagram       learn_set_node(3, ○)
> the server just runs the code?      DIAGNOSE: skipped routing
                                      learn_set_node(3, ◐, gap)
                                      learn_observe(habit: skips the
                                        step between layers)
agent: names the missed step, asks
  a redo with /dogs/7
> parse, no route, 404, code never
  runs. routing is before handler,
  that's what I missed                right, right, self-named gap
                                      learn_set_node(3, ●, rewritten
                                        with "trap I fell into")
   ... nodes 4, 5 ...
agent: final check, walk through
  typing a URL
> (full walkthrough in own words)     all nodes present -> learn_finish
agent: prints map, parked side
  topics, notes path. prompt detached
> /learn share                        gh gist create -> URL into index

next week:
> /learn new web servers              promotion pass; inject index +
                                      http-round-trip map table
agent: "you already have request
  format, routing, response. map
  starts where that one ended."
```

## Deferred, named

- `/learn revise`: spaced repetition over ● nodes from old topics.
- Other question shapes: "finish this diagram", "predict the output".
- Topic links: notes linking to another topic file when a prerequisite
  became its own run.

## Changes after design and plan review

- Runs are restored when a session is reopened with `pi --resume`
  (design D1), instead of never surviving a restart.
- The pitch: `start-from`, `assume` and `define` in the front matter,
  shown with the map, kept current by `learn_set_pitch`, and carried into
  later calibrations (design D3, plan phase 5).
- A fixed teacher-voice rule in the teaching prompt.
- `index.json` nests topics under `topics` and adds `share_notice_shown`.
- The learner profile is hardened against prompt injection after a
  security review: the prompt frames it as notes rather than
  instructions, `learn_set_profile` is gated to one write in a
  `/learn new` promotion pass that closes after the first turn or the
  first other `learn_*` call, and each profile line must carry a
  `last_seen` marker and stay within 200 characters.
- Decision record: docs/adr/0001-topic-notes-file-holds-map-and-node-state.md.
