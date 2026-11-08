import { expect, test } from "bun:test";
import type { MarkdownTheme } from "@earendil-works/pi-tui";
import { renderCard } from "./card";

const plain = (text: string): string => text;
const theme = {
  fg: (_color: unknown, text: string) => `<${text}>`,
  bg: (_color: unknown, text: string) => text,
  bold: (text: string) => `*${text}*`,
};
const markdown: MarkdownTheme = {
  heading: plain,
  link: plain,
  linkUrl: plain,
  code: plain,
  codeBlock: plain,
  codeBlockBorder: plain,
  quote: plain,
  quoteBorder: plain,
  hr: plain,
  listBullet: plain,
  bold: plain,
  italic: plain,
  strikethrough: plain,
  underline: plain,
};

test("a card renders its title in the accent colour and its Markdown body as a table", () => {
  const box = renderCard(
    {
      title: "2 topics",
      body: "| Topic | Status |\n| --- | --- |\n| `dns` | done |",
    },
    theme as never,
    markdown,
  );

  const lines = box.render(60).map((line) => line.replace(/\s+$/, ""));

  expect(lines).toContain(" *<● 2 topics>*");
  expect(lines.some((line) => line.includes("Topic") && line.includes("Status"))).toBe(true);
  expect(lines.some((line) => line.includes("dns") && line.includes("done"))).toBe(true);
});

test("a card with no saved data still renders a title", () => {
  const lines = renderCard(undefined, theme as never, markdown).render(40);
  expect(lines.join("\n")).toContain("pi-learn");
});
