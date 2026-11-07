import { Type } from "typebox";
import { assertValid, duplicateProblem, singleLineProblem, termProblem } from "../validate";
import { defineLearnTool } from "./define";

export const setPitchTool = defineLearnTool({
  name: "learn_set_pitch",
  label: "Save learn pitch",
  description:
    "Save how to pitch this topic to the learner. Call it when they agree to the map and pitch, and again whenever their words show a term is known (move it to assume) or unknown (move it to define), or they say it is too basic or too dense (rewrite start_from). Send the whole pitch each time.",
  parameters: Type.Object({
    start_from: Type.String({
      description: "One plain sentence: what they already have and where teaching starts",
    }),
    assume: Type.Array(Type.String(), { description: "Terms to use without explaining" }),
    define: Type.Array(Type.String(), {
      description: "Terms to explain in one line on first use",
    }),
  }),
  async run(params, deps, run) {
    const assume = params.assume.map((term) => term.trim());
    const define = params.define.map((term) => term.trim());
    assertValid(
      singleLineProblem("start_from", params.start_from),
      ...[...assume, ...define].map(termProblem),
      duplicateProblem("term", [...assume, ...define]),
    );
    await deps.store.updateTopic(run.slug, (doc) => ({
      ...doc,
      pitch: { startFrom: params.start_from.trim(), assume, define },
    }));
    return "Pitch saved.";
  },
});
