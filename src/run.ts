export interface ActiveRun {
  readonly slug: string;
  readonly lookupTools: readonly string[];
  readonly firstRunEver: boolean;
  /**
   * True only while a /learn new run's promotion pass may still rewrite profile.md: until the
   * first turn ends, any other learn_* tool runs, or the profile is saved.
   */
  readonly promotionOpen: boolean;
  /** False until the learner types a message in this run, so a first map waits for calibration. */
  readonly heardLearner: boolean;
}

export interface RunSlot {
  current(): ActiveRun | undefined;
  set(run: ActiveRun | undefined): void;
}

/**
 * Ends the promotion pass. Code closes it, not the model, so a profile write cannot be
 * accepted later in a run, after the model has read some page or file.
 */
export function closePromotion(slot: RunSlot): void {
  const run = slot.current();
  if (run?.promotionOpen) slot.set({ ...run, promotionOpen: false });
}

export function markHeardLearner(slot: RunSlot): void {
  const run = slot.current();
  if (run && !run.heardLearner) slot.set({ ...run, heardLearner: true });
}

/** A first map or pitch is pitched at nobody until the learner has answered calibration. */
export const calibrationProblem = (run: ActiveRun, mapSize: number): string | undefined =>
  run.heardLearner || mapSize > 0
    ? undefined
    : "Calibrate first: ask what the learner already knows and wait for their answer before you save a map or a pitch.";

export function createRunSlot(): RunSlot {
  let active: ActiveRun | undefined;
  return {
    current: () => active,
    set: (run) => {
      active = run;
    },
  };
}
