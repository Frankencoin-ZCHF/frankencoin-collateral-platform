/**
 * GitHub Discussions for a collateral. Resolution order:
 *   1. an explicit discussion URL in the assessment (`links.discussion`, or any link
 *      pointing at the discussions forum)
 *   2. heuristic: threads in the "Acceptable Collaterals" category whose title contains
 *      the ticker (whole word) or the asset name
 * Everything needs GITHUB_TOKEN (GraphQL). Without it, callers get `available: false`.
 */

import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { DISCUSSION_CATEGORY_SLUG, GITHUB_WEB } from "@/lib/constants";
import { describeForLog, MissingSecretError } from "@/lib/errors";
import { sanitizeHtml } from "@/lib/markdown";
import * as github from "@/upstream/github";
import type { Assessment, Discussion, DiscussionComment, DiscussionSummary } from "@/types";

const [OWNER, NAME] = (config.discussionsRepo.split("/") as [string, string]);

export function categoryUrl(): string {
  return `${GITHUB_WEB}/${config.discussionsRepo}/discussions/categories/${DISCUSSION_CATEGORY_SLUG}`;
}

export function numberFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  const m = /\/discussions\/(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

interface GqlComment {
  id: string;
  url: string;
  createdAt: string;
  bodyHTML: string;
  upvoteCount: number;
  author: { login: string; avatarUrl: string } | null;
  replies?: { nodes: GqlComment[] };
}

function mapComment(c: GqlComment): DiscussionComment {
  return {
    id: c.id,
    url: c.url,
    author: c.author?.login ?? null,
    authorAvatar: c.author?.avatarUrl ?? null,
    createdAt: c.createdAt,
    html: sanitizeHtml(c.bodyHTML ?? ""),
    upvotes: c.upvoteCount ?? 0,
    replies: (c.replies?.nodes ?? []).map(mapComment),
  };
}

/** All threads in the collateral category (title + counts), for the heuristic. */
export function categoryThreads(): Promise<DiscussionSummary[]> {
  return getOrLoad(`svc:discussions:category`, 10 * TTL.MINUTE, async () => {
    const cats = await github.graphql<{ repository: { discussionCategories: { nodes: { id: string; slug: string }[] } } }>(
      `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ discussionCategories(first:25){ nodes{ id slug } } } }`,
      { owner: OWNER, name: NAME },
    );
    const cat = cats.repository.discussionCategories.nodes.find((c) => c.slug === DISCUSSION_CATEGORY_SLUG);
    if (!cat) return [];
    const out: DiscussionSummary[] = [];
    let after: string | null = null;
    for (let page = 0; page < 3; page++) {
      const res: { repository: { discussions: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { number: number; title: string; url: string; createdAt: string; comments: { totalCount: number } }[] } } } =
        await github.graphql(
          `query($owner:String!,$name:String!,$cat:ID!,$after:String){ repository(owner:$owner,name:$name){
            discussions(first:100, categoryId:$cat, after:$after, orderBy:{field:CREATED_AT, direction:DESC}){
              pageInfo{ hasNextPage endCursor }
              nodes{ number title url createdAt comments{ totalCount } } } } }`,
          { owner: OWNER, name: NAME, cat: cat.id, after },
        );
      const d = res.repository.discussions;
      out.push(...d.nodes.map((n) => ({ number: n.number, title: n.title, url: n.url, createdAt: n.createdAt, commentCount: n.comments.totalCount })));
      if (!d.pageInfo.hasNextPage) break;
      after = d.pageInfo.endCursor;
    }
    return out;
  }, { swrMs: TTL.HOUR });
}

/** Pure matcher — exported for tests. */
export function matchThreads(threads: DiscussionSummary[], ticker: string, assetName: string): DiscussionSummary[] {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const t = ticker.trim();
  const tickerRe = t.length >= 2 ? new RegExp(`(^|[^a-z0-9])\\$?${esc(t)}([^a-z0-9]|$)`, "i") : null;
  const name = assetName.trim();
  const nameRe = name.length >= 4 ? new RegExp(esc(name), "i") : null;
  return threads
    .filter((th) => (tickerRe && tickerRe.test(th.title)) || (nameRe && nameRe.test(th.title)))
    .sort((a, b) => b.commentCount - a.commentCount || b.createdAt.localeCompare(a.createdAt));
}

export function fetchDiscussion(number: number, matchedBy: Discussion["matchedBy"]): Promise<Discussion> {
  return getOrLoad(`svc:discussions:${number}`, 10 * TTL.MINUTE, async () => {
    const res = await github.graphql<{
      repository: {
        discussion: {
          number: number;
          title: string;
          url: string;
          createdAt: string;
          updatedAt: string;
          bodyHTML: string;
          upvoteCount: number;
          author: { login: string; avatarUrl: string } | null;
          category: { name: string };
          comments: { totalCount: number; nodes: GqlComment[] };
        } | null;
      };
    }>(
      `query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ discussion(number:$number){
        number title url createdAt updatedAt bodyHTML upvoteCount author{ login avatarUrl } category{ name }
        comments(first:50){ totalCount nodes{ id url createdAt bodyHTML upvoteCount author{ login avatarUrl }
          replies(first:25){ nodes{ id url createdAt bodyHTML upvoteCount author{ login avatarUrl } } } } } } } }`,
      { owner: OWNER, name: NAME, number },
    );
    const d = res.repository.discussion;
    if (!d) throw new Error(`discussion #${number} not found`);
    return {
      number: d.number,
      title: d.title,
      url: d.url,
      category: d.category?.name ?? "",
      author: d.author?.login ?? null,
      authorAvatar: d.author?.avatarUrl ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      commentCount: d.comments.totalCount,
      upvotes: d.upvoteCount ?? 0,
      html: sanitizeHtml(d.bodyHTML ?? ""),
      comments: d.comments.nodes.map(mapComment),
      matchedBy,
    };
  }, { swrMs: TTL.HOUR });
}

export interface DiscussionResult {
  available: boolean;
  /** Why unavailable (no token / error). */
  reason: string | null;
  primary: Discussion | null;
  /** Other matching threads (heuristic), excluding the primary. */
  related: DiscussionSummary[];
  categoryUrl: string;
  declaredUrl: string | null;
}

export async function forCollateral(assessment: Assessment | null, ticker: string, assetName: string): Promise<DiscussionResult> {
  const declaredUrl = assessment?.data.discussionUrl ?? null;
  const base: DiscussionResult = { available: false, reason: null, primary: null, related: [], categoryUrl: categoryUrl(), declaredUrl };
  if (!github.hasToken()) return { ...base, reason: "GITHUB_TOKEN is not configured on this server" };

  try {
    const declaredNumber = numberFromUrl(declaredUrl);
    const threads = await categoryThreads().catch((e) => {
      console.error(`[discussions] category listing failed: ${describeForLog(e)}`);
      return [] as DiscussionSummary[];
    });
    const matches = matchThreads(threads, ticker, assetName);

    let primary: Discussion | null = null;
    if (declaredNumber) primary = await fetchDiscussion(declaredNumber, "declared");
    else if (matches[0]) primary = await fetchDiscussion(matches[0].number, "heuristic");

    return {
      ...base,
      available: true,
      primary,
      related: matches.filter((m) => m.number !== primary?.number),
    };
  } catch (e) {
    if (e instanceof MissingSecretError) return { ...base, reason: "GITHUB_TOKEN is not configured on this server" };
    console.error(`[discussions] ${describeForLog(e)}`);
    return { ...base, reason: "GitHub Discussions could not be loaded" };
  }
}
