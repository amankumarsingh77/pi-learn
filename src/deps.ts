import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { RunSlot } from "./run";
import type { LearnStore } from "./store/learn-store";

export interface LearnDeps {
  readonly pi: ExtensionAPI;
  readonly store: LearnStore;
  readonly slot: RunSlot;
  /** Every learn_* tool name; these are active only while a run is. */
  readonly toolNames: readonly string[];
}
