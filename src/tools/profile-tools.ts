import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { OBSERVATION_KINDS } from "../model";
import { closePromotion } from "../run";
import { assertValid, observationProblem, profileProblem } from "../validate";
import { defineLearnTool } from "./define";

export const observeTool = defineLearnTool({
  name: "learn_observe",
  label: "Record observation",
  description:
    "Record one thing diagnose noticed about how the learner thinks: a reasoning habit, an explanation style that landed, prior knowledge, or their own word for something. Observations never enter the prompt; patterns that repeat across topics are promoted into the profile at the start of a later run.",
  parameters: Type.Object({
    kind: StringEnum(OBSERVATION_KINDS),
    note: Type.String({
      description: "One line of at most 200 characters a later teacher can act on",
    }),
  }),
  async run(params, deps, run) {
    assertValid(observationProblem(params.note));
    await deps.store.appendObservation({
      topic: run.slug,
      kind: params.kind,
      note: params.note.trim(),
    });
    return "Observation recorded.";
  },
});

export const setProfileTool = defineLearnTool({
  name: "learn_set_profile",
  label: "Rewrite learner profile",
  description:
    "Rewrite profile.md once, during the promotion pass in the first turn of a new run, before any other learn_* tool; any other call is refused. Send the whole profile, at most 20 lines of at most 200 characters, each ending with <!-- last_seen: N -->; anything else is refused.",
  parameters: Type.Object({
    profile: Type.String({
      description: "Every line: a pattern, what to do about it, then <!-- last_seen: N -->",
    }),
  }),
  async run(params, deps, run) {
    assertValid(
      run.promotionOpen
        ? undefined
        : "profile.md can only be rewritten during the promotion pass, in the first turn of a new run and before any other learn_* tool",
      profileProblem(params.profile),
    );
    const reviewed = (await deps.store.readObservations()).length;
    await deps.store.writeProfile(params.profile);
    await deps.store.updateIndex((index) => ({ ...index, observations_reviewed: reviewed }));
    closePromotion(deps.slot);
    return "Profile saved.";
  },
});
