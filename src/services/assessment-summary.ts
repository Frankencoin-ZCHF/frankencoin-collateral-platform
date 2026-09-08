import { Marked } from "marked";
import { renderMarkdown } from "@/lib/markdown";
/** Preserve the author's words and sanitisation; do not depend on particular template headings. */
export function assessmentExcerpt(body: string): string {
  const paragraphs = new Marked()
    .lexer(body)
    .filter((t) => t.type === "paragraph" && t.raw.length > 60)
    .slice(0, 2)
    .map((t) => t.raw);
  return renderMarkdown(paragraphs.join("\n\n")).html;
}
