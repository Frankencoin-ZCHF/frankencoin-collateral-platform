import { Marked } from "marked";
import { renderMarkdown } from "@/lib/markdown";

export interface AssessmentSummary {
  html: string;
  kind: "summary" | "excerpt";
}

/** Prefer the complete author summary; arbitrary document layouts still get an opening excerpt. */
export function assessmentSummary(body: string): AssessmentSummary {
  const tokens = new Marked().lexer(body);
  const start = tokens.findIndex(
    (t) => t.type === "heading" && /^(?:\d+[.)]?\s+)?(?:executive\s+)?summary\s*:?$/i.test(t.text.replace(/<[^>]*>|[*_`]/g, "").trim()),
  );
  if (start >= 0) {
    const heading = tokens[start]!;
    if (heading.type === "heading") {
      let end = start + 1;
      while (end < tokens.length) {
        const token = tokens[end]!;
        if (token.type === "heading" && token.depth <= heading.depth) break;
        end++;
      }
      const markdown = tokens
        .slice(start + 1, end)
        .map((t) => t.raw)
        .join("")
        .trim();
      if (markdown) {
        // Summary subheadings also appear in the full report; keep its IDs authoritative.
        const html = renderMarkdown(markdown).html.replace(/ id="[^"]*"/g, "");
        return { html, kind: "summary" };
      }
    }
  }
  const paragraphs = tokens
    .filter((t) => t.type === "paragraph" && t.raw.length > 60)
    .slice(0, 2)
    .map((t) => t.raw);
  return { html: renderMarkdown(paragraphs.join("\n\n")).html.replace(/ id="[^"]*"/g, ""), kind: "excerpt" };
}

/** Retained for callers that only need rendered author text. */
export function assessmentExcerpt(body: string): string {
  return assessmentSummary(body).html;
}
