import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import type { LearnDeps } from "../deps";
import type { ActiveRun } from "../run";

export interface LearnTool<P extends TSchema = TSchema> {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly parameters: P;
  run(params: Static<P>, deps: LearnDeps, run: ActiveRun, ctx: ExtensionContext): Promise<string>;
}

export const defineLearnTool = <P extends TSchema>(tool: LearnTool<P>): LearnTool<P> => tool;
