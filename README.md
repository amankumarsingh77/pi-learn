# pi-learn

A [pi](https://pi.dev) extension that teaches you a topic, one question at a time.

A right answer can hide wrong reasoning, so pi-learn asks for your messy, half-formed thinking and judges the reasoning, not just the answer. It explains with ASCII diagrams, pitches each explanation to what you already know, and writes everything to a notes file you can read, resume and share.

## Install

```bash
pi install npm:pi-learn
```

or straight from GitHub:

```bash
pi install git:github.com/amankumarsingh77/pi-learn
```

Needs pi 1.4 or later. Sharing notes also needs the [GitHub CLI](https://cli.github.com), logged in with `gh auth login`.

## Use it

```text
/learn new <topic>      calibrate, build a map, get a yes, teach
/learn resume <topic>   continue a topic at its first ◐ or ○ node
/learn list             topics and their status
/learn profile          print what pi-learn has learned about you
/learn share [topic]    upload a topic's notes to a secret GitHub gist
/learn stop             save, print the map, return pi to normal use
```

A lesson goes like this:

1. **Calibrate.** It asks what you already know about the topic. Say what you actually think, even if it's wrong. It builds no map until you've answered.
2. **Map and pitch.** It proposes a short list of nodes in teaching order, so each node needs only the ones before it, each "must know" or "enough". It also says in one sentence where it will start and which terms it will use without explaining. Edit either, then say "good".
3. **Teach each node.** It opens from what the previous node taught, builds the idea one step at a time with a diagram, asks one question, and reads your reasoning:
   - right answer, right reasoning: ●
   - right answer, wrong reasoning: ◐, and it fixes the mental model
   - wrong answer, partly right reasoning: it finds the step where you went wrong
   - wrong answer, wrong reasoning: ✗, and it re-teaches from the missing piece
4. **Final check.** When every "must know" node is ●, it asks one question that spans them all.

Each topic gets a short id from the content words of its title, so `/learn new how does a CDN work for video streaming` becomes `cdn-work-video-streaming`; `/learn list` shows every id next to its full title. `/learn stop` hands pi back to normal coding at any point. `/learn resume <topic>` picks up where you left off. If you quit pi mid-lesson, reopening that session with `pi --resume` puts you back in the lesson.

While a lesson runs, pi-learn uses whatever search or fetch tools your pi has, such as web search or context7, to fact-check claims before teaching them. With none installed, it warns you once that claims can't be checked.

## Your notes

Everything lives in `~/.pi/learn/`. Set `PI_LEARN_DIR` to use another folder.

```text
~/.pi/learn/
├── <topic>.md           the map, your level for the topic, and one section per node:
│                        explanation, diagram, your own words, the trap you fell into
├── index.json           every topic, its status and its gist link
├── profile.md           at most 20 short notes on how you learn; edit or delete freely
└── observations.jsonl   raw evidence the profile is built from
```

During a lesson the model can't open this folder with its file or shell tools; pi-learn reads and writes it for the model.

`<topic>.md` is plain Markdown, so it reads fine in any editor or on GitHub. `/learn share` uploads only that file, as a secret gist. A secret gist is unlisted, not private: anyone with the link can read it. Later shares update the same gist. `profile.md` and `observations.jsonl` are never shared.

## Develop

```bash
bun install
bun run check                     # typecheck, lint, tests
pi -e /path/to/pi-learn           # load your checkout into pi
```

Design decisions are recorded in [`docs/adr/`](docs/adr/INDEX.md).

## License

[MIT](LICENSE)
