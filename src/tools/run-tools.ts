import { Type } from "typebox";
import { endRun } from "../lifecycle";
import { defineLearnTool } from "./define";

export const finishTool = defineLearnTool({
  name: "learn_finish",
  label: "Finish learn run",
  description:
    "Call after every must-know node is ● and the learner passed the final check. Marks the topic done and ends the run. Show the learner the summary it returns and offer a parked side topic as the next topic.",
  parameters: Type.Object({}),
  async run(_params, deps, run, ctx) {
    const doc = await deps.store.readTopic(run.slug);
    if (doc.nodes.length === 0) throw new Error("cannot finish: the map is empty");
    const open = doc.nodes.filter((node) => node.depth === "must know" && node.state !== "●");
    if (open.length > 0) {
      throw new Error(
        `cannot finish: these must-know nodes are not ● yet: ${open.map((node) => node.name).join(", ")}`,
      );
    }
    await deps.store.updateTopic(run.slug, (current) => ({ ...current, status: "done" }));
    return endRun(deps, ctx);
  },
});

export const pauseTool = defineLearnTool({
  name: "learn_pause",
  label: "Pause learn run",
  description:
    "Call when the learner says they are done for now or want to stop. Ends the run so pi returns to normal use; node states are already saved. Show the learner the summary it returns.",
  parameters: Type.Object({}),
  run: (_params, deps, _run, ctx) => endRun(deps, ctx),
});
