import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { DEPTHS, NODE_STATES } from "../model";
import { agreementProblem, calibrationProblem, markAwaitingAgreement } from "../run";
import { renderMapTable, renderNodeBody } from "../store/topic-file";
import {
  assertValid,
  diagramProblem,
  duplicateProblem,
  explanationProblem,
  singleLineProblem,
  textProblem,
} from "../validate";
import { defineLearnTool } from "./define";

export const setMapTool = defineLearnTool({
  name: "learn_set_map",
  label: "Save learn map",
  description:
    "Save the proposed goal and node map, show both with the pitch, and end your turn: learn_set_node is refused until the learner replies. Save the map again whenever they change it. A node keeps its state while its name is unchanged.",
  parameters: Type.Object({
    goal: Type.String({ description: "One line: what the learner wants to be able to explain" }),
    nodes: Type.Array(Type.Object({ name: Type.String(), depth: StringEnum(DEPTHS) }), {
      minItems: 1,
      description: "In teaching order",
    }),
  }),
  async run(params, deps, run) {
    const names = params.nodes.map((node) => node.name.trim());
    assertValid(
      singleLineProblem("goal", params.goal),
      ...names.map((name) => singleLineProblem("node name", name)),
      duplicateProblem("node name", names),
    );
    let firstMap = false;
    const doc = await deps.store.updateTopic(run.slug, (current) => {
      assertValid(calibrationProblem(run, current.nodes.length));
      firstMap = current.nodes.length === 0;
      return {
        ...current,
        goal: params.goal.trim(),
        nodes: params.nodes.map((node, i) => ({
          name: names[i] ?? node.name,
          depth: node.depth,
          state: current.nodes.find((old) => old.name === names[i])?.state ?? "○",
        })),
        sections: Object.fromEntries(
          Object.entries(current.sections).filter(([name]) => names.includes(name)),
        ),
      };
    });
    if (firstMap) markAwaitingAgreement(deps.slot);
    return `Map saved.\n${renderMapTable(doc.nodes)}`;
  },
});

export const setNodeTool = defineLearnTool({
  name: "learn_set_node",
  label: "Save learn node",
  description:
    "Write a node's section and state. Refused until the learner has replied to the first map. Call it at EXPLAIN with state ○, so the explanation is saved even if the learner stops before answering, and again at DIAGNOSE with the verdict. Each call rewrites the whole section, so send the full correct model every time, not only what changed.",
  parameters: Type.Object({
    node: Type.Integer({ minimum: 1, description: "Node number from the map" }),
    state: StringEnum(NODE_STATES, {
      description: "○ untouched, ◐ shaky (right answer, wrong reason), ● solid, ✗ wrong",
    }),
    explanation: Type.String({
      description:
        "The whole correct model of this node as you taught it: the link to the previous node first, then each idea before the ideas that depend on it, in short paragraphs of two to four sentences separated by a blank line. At DIAGNOSE resend this model with the fixed piece worked in; never replace it with the answer to the question.",
    }),
    diagram: Type.String({
      description: "ASCII diagram without fences, at most 72 columns per line",
    }),
    learner_words: Type.Optional(Type.String({ description: "The learner's own words, verbatim" })),
    trap: Type.Optional(
      Type.String({ description: "The wrong turn the learner took and then fixed" }),
    ),
    gap: Type.Optional(Type.String({ description: "What the learner still misses; omit when ●" })),
    sources: Type.Optional(
      Type.Array(Type.String(), { description: "Links used to fact-check, one link per entry" }),
    ),
  }),
  async run(params, deps, run) {
    assertValid(
      agreementProblem(run),
      diagramProblem(params.diagram),
      explanationProblem(params.explanation),
      ...[params.learner_words, params.trap, params.gap].map((text) =>
        textProblem("text", text ?? ""),
      ),
      ...(params.sources ?? []).map((source) => singleLineProblem("source", source)),
    );
    const at = params.node - 1;
    const doc = await deps.store.updateTopic(run.slug, (current) => {
      const target = current.nodes[at];
      if (!target) {
        throw new Error(
          `node ${params.node} is not on the map; it has ${current.nodes.length} nodes`,
        );
      }
      const body = renderNodeBody({
        explanation: params.explanation,
        diagram: params.diagram,
        learnerWords: params.learner_words,
        trap: params.trap,
        gap: params.gap,
        sources: params.sources ?? [],
      });
      return {
        ...current,
        nodes: current.nodes.map((node, i) => (i === at ? { ...node, state: params.state } : node)),
        sections: { ...current.sections, [target.name]: body },
      };
    });
    return `Node ${params.node} (${doc.nodes[at]?.name}) saved as ${params.state}.`;
  },
});

export const addSideTopicTool = defineLearnTool({
  name: "learn_add_side_topic",
  label: "Park side topic",
  description:
    "Park a side topic or big prerequisite that does not serve the goal right now. Parked topics are offered as the next topic when the run ends.",
  parameters: Type.Object({
    title: Type.String(),
    reason: Type.String({
      description: 'Why it was set aside, e.g. "not asked" or "parked prerequisite"',
    }),
  }),
  async run(params, deps, run) {
    const title = params.title.trim();
    assertValid(singleLineProblem("title", title), singleLineProblem("reason", params.reason));
    const item = `${title} (${params.reason.trim()})`;
    await deps.store.updateTopic(run.slug, (doc) =>
      doc.skipped.some((parked) => parked.startsWith(`${title} (`))
        ? doc
        : { ...doc, skipped: [...doc.skipped, item] },
    );
    return `Parked: ${item}`;
  },
});
