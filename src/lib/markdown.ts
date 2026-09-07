/**
 * Markdown → sanitized HTML with two extras:
 *   - headings get GitHub-style ids (for in-page navigation)
 *   - ```block fences are lifted out and replaced by `<!--fc-block:N-->` placeholders;
 *     the caller (blocks/content) validates and renders them.
 *
 * Everything that comes back from GitHub (assessments, discussion bodies) goes through
 * DOMPurify before reaching a page.
 */

import { Marked, type Tokens } from "marked";
import DOMPurify from "isomorphic-dompurify";

export interface BlockFence {
  index: number;
  yaml: string;
}

export interface RenderedMarkdown {
  html: string;
  fences: BlockFence[];
  headings: { id: string; text: string; level: number }[];
}

export const BLOCK_PLACEHOLDER = (i: number) => `<!--fc-block:${i}-->`;
export const BLOCK_PLACEHOLDER_RE = /<!--fc-block:(\d+)-->/g;

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function createMarked(state: { fences: BlockFence[]; headings: RenderedMarkdown["headings"]; ids: Map<string, number> }) {
  const md = new Marked({ gfm: true, breaks: false });
  md.use({
    renderer: {
      code(token: Tokens.Code) {
        if ((token.lang ?? "").trim().toLowerCase() === "block") {
          const index = state.fences.length;
          state.fences.push({ index, yaml: token.text });
          return BLOCK_PLACEHOLDER(index);
        }
        const lang = (token.lang ?? "").split(/\s+/)[0] ?? "";
        const cls = lang ? ` class="language-${escapeAttr(lang)}"` : "";
        return `<pre><code${cls}>${escapeHtml(token.text)}\n</code></pre>\n`;
      },
      heading(token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens);
        const base = slugifyHeading(token.raw.replace(/^#+\s*/, "")) || "section";
        const n = state.ids.get(base) ?? 0;
        state.ids.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        state.headings.push({ id, text: text.replace(/<[^>]+>/g, ""), level: token.depth });
        return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
      },
      link(token: Tokens.Link) {
        const text = this.parser.parseInline(token.tokens);
        const href = token.href;
        const external = /^https?:\/\//i.test(href);
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : "";
        const target = external ? ` target="_blank" rel="noopener noreferrer"` : "";
        return `<a href="${escapeAttr(href)}"${title}${target}>${text}</a>`;
      },
    },
  });
  return md;
}

const PURIFY_OPTS = {
  ADD_ATTR: ["target", "id"],
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_OPTS) as string;
}

/** Render markdown. Placeholders survive sanitization because DOMPurify keeps comments off by default only for scripts — we re-insert them after sanitizing. */
export function renderMarkdown(markdown: string): RenderedMarkdown {
  const state = { fences: [] as BlockFence[], headings: [] as RenderedMarkdown["headings"], ids: new Map<string, number>() };
  const md = createMarked(state);
  const rawHtml = md.parse(markdown, { async: false }) as string;

  // DOMPurify strips HTML comments; protect the placeholders with a marker element, then restore.
  const protectedHtml = rawHtml.replace(BLOCK_PLACEHOLDER_RE, (_m, i) => `<fc-block data-index="${i}"></fc-block>`);
  const clean = DOMPurify.sanitize(protectedHtml, { ...PURIFY_OPTS, ADD_TAGS: ["fc-block"], ADD_ATTR: [...PURIFY_OPTS.ADD_ATTR, "data-index"] }) as string;
  // marked wraps a lone fence in nothing; if it ended up inside <p>, unwrap so the block can be a sibling element.
  const html = clean
    .replace(/<p>\s*<fc-block data-index="(\d+)"><\/fc-block>\s*<\/p>/g, (_m, i) => BLOCK_PLACEHOLDER(Number(i)))
    .replace(/<fc-block data-index="(\d+)"><\/fc-block>/g, (_m, i) => BLOCK_PLACEHOLDER(Number(i)));

  return { html, fences: state.fences, headings: state.headings };
}

/** Split rendered HTML into segments around block placeholders: [html0, block?, html1, block?, ...]. */
export function splitAtPlaceholders(html: string): { html: string; blockIndex: number | null }[] {
  const parts: { html: string; blockIndex: number | null }[] = [];
  let last = 0;
  for (const m of html.matchAll(BLOCK_PLACEHOLDER_RE)) {
    parts.push({ html: html.slice(last, m.index), blockIndex: null });
    parts.push({ html: "", blockIndex: Number(m[1]) });
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push({ html: html.slice(last), blockIndex: null });
  return parts.filter((p) => p.blockIndex !== null || p.html.trim() !== "");
}

/** Split HTML into top-level sections at <h2> boundaries (used for collapsible narrative). */
export function splitSections(html: string): { id: string | null; heading: string | null; html: string }[] {
  const re = /<h2 id="([^"]*)">([\s\S]*?)<\/h2>/g;
  const sections: { id: string | null; heading: string | null; html: string }[] = [];
  let last = 0;
  let current: { id: string | null; heading: string | null } = { id: null, heading: null };
  for (const m of html.matchAll(re)) {
    const chunk = html.slice(last, m.index);
    if (chunk.trim() || current.heading) sections.push({ ...current, html: chunk });
    current = { id: m[1] ?? null, heading: (m[2] ?? "").replace(/<[^>]+>/g, "") };
    last = (m.index ?? 0) + m[0].length;
  }
  sections.push({ ...current, html: html.slice(last) });
  return sections.filter((s) => s.heading || s.html.trim());
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
