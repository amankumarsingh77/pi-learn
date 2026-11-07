import type { LearnDeps } from "../deps";
import { errorMessage } from "../errors";
import { closePromotion } from "../run";
import type { LearnTool } from "./define";
import { addSideTopicTool, setMapTool, setNodeTool } from "./map-tools";
import { setPitchTool } from "./pitch-tool";
import { observeTool, setProfileTool } from "./profile-tools";
import { finishTool, pauseTool } from "./run-tools";

export const LEARN_TOOLS: readonly LearnTool[] = [
  setMapTool,
  setPitchTool,
  setNodeTool,
  addSideTopicTool,
  finishTool,
  pauseTool,
  observeTool,
  setProfileTool,
];

const textResult = (text: string, isError = false) => ({
  content: [{ type: "text" as const, text }],
  details: undefined,
  ...(isError ? { isError: true } : {}),
});

export function registerLearnTools(
  deps: LearnDeps,
  tools: readonly LearnTool[] = LEARN_TOOLS,
): void {
  for (const tool of tools) {
    deps.pi.registerTool({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: tool.parameters,
      defaultActive: false,
      executionMode: "sequential",
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const run = deps.slot.current();
        if (!run)
          return textResult(
            "No learn run is active. The learner starts one with /learn new <topic>.",
            true,
          );
        if (tool !== setProfileTool) closePromotion(deps.slot);
        try {
          return textResult(await tool.run(params, deps, run, ctx));
        } catch (error) {
          return textResult(errorMessage(error), true);
        }
      },
    });
  }
}
