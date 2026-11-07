export interface ActiveRun {
  readonly slug: string;
  readonly lookupTools: readonly string[];
  readonly firstRunEver: boolean;
  /**
   * True only while a /learn new run's promotion pass may still rewrite profile.md: until the
   * first turn ends, any other learn_* tool runs, or the profile is saved.
   */
  readonly promotionOpen: boolean;
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

export function createRunSlot(): RunSlot {
  let active: ActiveRun | undefined;
  return {
    current: () => active,
    set: (run) => {
      active = run;
    },
  };
}
