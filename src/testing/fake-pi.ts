import type {
  ExtensionAPI,
  ExtensionCommandContext,
  RegisteredCommand,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

type CommandOptions = Omit<RegisteredCommand, "name" | "sourceInfo">;
type Handler = (event: unknown, ctx: ExtensionCommandContext) => unknown;

/** The tools pi has active before any learn run touches them. */
export const CODING_TOOLS: readonly string[] = ["read", "bash", "edit", "write"];

export interface SavedEntry {
  readonly customType: string;
  readonly data: unknown;
}

type SendOptions = NonNullable<Parameters<ExtensionAPI["sendMessage"]>[1]>;

export interface SentMessage {
  readonly customType: string;
  readonly content: unknown;
  readonly display: boolean | undefined;
  readonly triggerTurn: boolean;
  readonly deliverAs: SendOptions["deliverAs"];
}

export interface FakeState {
  notices: { message: string; type: string }[];
  sent: SentMessage[];
  entries: SavedEntry[];
  active: readonly string[];
  otherTools: string[];
  execCalls: string[][];
  execResults: { stdout: string; stderr: string; code: number }[];
}

export function createFakePi(seed: { entries?: SavedEntry[]; otherTools?: string[] } = {}) {
  const commands = new Map<string, CommandOptions>();
  const tools = new Map<string, ToolDefinition>();
  const handlers = new Map<string, Handler[]>();
  const state: FakeState = {
    notices: [],
    sent: [],
    entries: [...(seed.entries ?? [])],
    active: [...CODING_TOOLS],
    otherTools: seed.otherTools ?? ["read", "bash", "edit", "write", "web_search"],
    execCalls: [],
    execResults: [],
  };

  const ctx = {
    ui: { notify: (message: string, type = "info") => state.notices.push({ message, type }) },
    hasUI: true,
    mode: "tui",
    sessionManager: {
      getBranch: () => state.entries.map((entry) => ({ type: "custom", ...entry })),
    },
  } as unknown as ExtensionCommandContext;

  const api = {
    registerCommand: (name: string, options: CommandOptions) => commands.set(name, options),
    registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool),
    on: (event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => undefined;
    },
    getActiveTools: () => [...state.active],
    setActiveTools: (names: string[]) => {
      state.active = [...names];
    },
    getAllTools: () =>
      [...state.otherTools, ...tools.keys()].map((name) => ({ name, exposure: "direct" })),
    appendEntry: (customType: string, data: unknown) => state.entries.push({ customType, data }),
    sendMessage: (
      message: { customType: string; content: unknown; display?: boolean },
      options?: SendOptions,
    ) =>
      state.sent.push({
        customType: message.customType,
        content: message.content,
        display: message.display,
        triggerTurn: options?.triggerTurn ?? false,
        deliverAs: options?.deliverAs,
      }),
    exec: async (command: string, args: string[]) => {
      state.execCalls.push([command, ...args]);
      return {
        killed: false,
        ...(state.execResults.shift() ?? { stdout: "", stderr: "", code: 0 }),
      };
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    ctx,
    state,
    async command(line: string): Promise<void> {
      const [name = "", ...rest] = line.replace(/^\//, "").split(" ");
      const command = commands.get(name);
      if (!command) throw new Error(`no command named ${name}`);
      await command.handler(rest.join(" "), ctx);
    },
    async tool(name: string, params: unknown): Promise<{ text: string; isError: boolean }> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`no tool named ${name}`);
      const result = await tool.execute(
        "call-1",
        params as never,
        undefined,
        undefined,
        ctx as never,
      );
      const text = result.content.map((part) => ("text" in part ? part.text : "")).join("");
      return { text, isError: result.isError === true };
    },
    registeredTools: (): ToolDefinition[] => [...tools.values()],
    async emit(event: string, payload: unknown): Promise<unknown[]> {
      return Promise.all((handlers.get(event) ?? []).map((handler) => handler(payload, ctx)));
    },
  };
}

export type FakePi = ReturnType<typeof createFakePi>;
