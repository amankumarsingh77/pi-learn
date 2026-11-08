import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Box, Markdown, type MarkdownTheme, Text } from "@earendil-works/pi-tui";

/** A durable chat card: rendered by pi's TUI, kept in the session, never sent to the model. */
export const CARD_ENTRY = "pi-learn-card";

export interface CardData {
  readonly title: string;
  /** Markdown; pi renders tables, lists, links and code the same way it renders replies. */
  readonly body: string;
}

/** Shows a card in the chat, or prints it as a plain notice where there is no TUI to draw it. */
export function showCard(pi: ExtensionAPI, ctx: ExtensionContext, card: CardData): void {
  if (ctx.hasUI && ctx.mode === "tui") {
    pi.appendEntry<CardData>(CARD_ENTRY, card);
    return;
  }
  ctx.ui.notify(`${card.title}\n\n${card.body}`, "info");
}

export function registerCardRenderer(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<CardData>(CARD_ENTRY, (entry, _options, theme) =>
    renderCard(entry.data, theme, getMarkdownTheme()),
  );
}

export function renderCard(
  data: CardData | undefined,
  theme: Pick<Theme, "fg" | "bg" | "bold">,
  markdown: MarkdownTheme,
): Box {
  const card = data ?? { title: "pi-learn", body: "" };
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(theme.bold(theme.fg("accent", `● ${card.title}`)), 0, 0));
  if (card.body.trim() !== "") box.addChild(new Markdown(card.body, 0, 0, markdown));
  return box;
}
