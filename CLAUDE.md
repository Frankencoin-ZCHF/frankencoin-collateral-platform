# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **Frankencoin Collateral Platform** (`collateral.frankencoin.com`): one place for everything
about the assets that back Frankencoin (ZCHF) — the risk assessments maintained as markdown in
`Frankencoin-ZCHF/frankencoin-collateral-assessments`, live on-chain data from `api.frankencoin.com`,
GitHub-discussion threads, and version history/diffs of each assessment.

Server-rendered Astro 5 (`@astrojs/node` standalone) + Tailwind 4 + Alpine, TypeScript. Design tokens,
fonts and layout components are **copied from `../frankencoin-site`** — keep them visually in sync
rather than diverging. Read-only, public, no auth, no database: an in-memory cache in front of
upstream APIs is the only state.

## Commands (yarn — not npm)

```bash
yarn install
yarn dev                 # http://localhost:3000 (PORT env overrides)
yarn build && yarn start # production: node ./dist/server/entry.mjs
yarn check               # astro check (types across .astro/.ts)
yarn test                # vitest, all suites
yarn test test/protocol.test.ts    # one file
yarn test -t "matchThreads"        # one test name
```

Env vars are all optional (`.env.example`). `GITHUB_TOKEN` matters most: without it, discussions
are link-only and GitHub history runs on the 60 req/h unauthenticated quota.

## Architecture (layered, like frankencoin-mcp)

```
pages/*.astro ──▶ services/* ──▶ upstream/* ──▶ lib/cache.ts
   │                 │                 └── the ONLY layer doing network I/O
   │                 └── compose upstream data into domain objects (src/types.ts)
   └── blocks/*: detail-page plugins (see below)
```

- `src/services/assessments.ts` — index of `assessments/{draft,published,deprecated}/<TICKER>.md`
  via the Git Trees API (1 call) + `raw.githubusercontent.com` (no API quota); `versions()` queries
  the Commits API for **all three folders** because files move between them and `?path=` does not
  follow renames; `atVersion()` reads the file at a sha (cached 24 h).
- `src/services/protocol.ts` — `buildSnapshot()` groups `/positions/list` (V1+V2) by collateral
  address and joins `/prices/list` + `/challenges/list`. Ponder's aggregates are per chain, so this
  grouping is the only way to get per-collateral numbers.
- `src/services/collaterals.ts` — `join()` unions assessed and live collaterals by lowercase
  address into `CollateralRecord[]`; `summarize()` feeds the overview KPIs. Unlisted tokens with no
  active positions (one-off denied positions like ZEUS/HPS) are dropped here.
- `src/services/discussions.ts` — GraphQL only (needs token). Thread resolution: explicit
  `links.discussion` URL in the frontmatter → else `matchThreads()` heuristic on the
  "Acceptable Collaterals" category titles.
- `src/lib/frontmatter.ts` mirrors the assessments repo's `scripts/validate.js` delimiter logic
  (`---` … `indexOf("---", 3)`) and its JSON schema as zod, kept `.loose()` so new keys such as
  `links.discussion` / `blocks` pass through.

### Block system (`src/blocks/`)

The detail page is a list of blocks run by `runBlocks()` with per-block timeouts; a failing block
renders an "unavailable" card, never a 500.

- **System blocks** `src/blocks/system/<id>/{index.ts,Block.astro}`, registered in order in
  `src/blocks/index.ts`. Adding one = new folder + one line.
- **Content blocks** are declared by assessment authors inside the markdown as ```` ```block ````
  fences (YAML) or a frontmatter `blocks: []` array. `src/lib/markdown.ts` lifts fences into
  `<!--fc-block:N-->` placeholders; `src/blocks/content/registry.ts` validates each spec with the
  type's zod schema and loads it; the `narrative` system block renders them inline. Types live in
  `src/blocks/content/types/<type>/`. Author-supplied URLs go through the SSRF guard in
  `src/upstream/generic.ts` — never `fetch()` them directly. Docs: `docs/content-blocks.md`
  (a test fails if a registered type is undocumented).

### Client islands

Only two scripts ship to the browser: `src/scripts/collateral-grid.ts` (AG Grid Community, fed by
the JSON embedded in `#grid-data`, toolbar wiring, SSR fallback table hidden on mount) and
`src/scripts/charts.ts` (ECharts; any `[data-chart][data-series]` element, reused by the `chart`
content block). Alpine is bundled from npm (no CDN) so the CSP stays `script-src 'self'`.

## Gotchas

- **Number encodings:** token amounts are BigInt strings → `fromWei(v, decimals)`; position
  liquidation prices are scaled by `36 - decimals`; `riskPremiumPPM`/`reserveContribution` are PPM
  → `ppmToPercent`. V2 positions carry both `riskPremiumPPM` (premium) and `annualInterestPPM`
  (total rate); V1 only has `annualInterestPPM`. The `cooldown` field can be 2^256 — `isoFromUnix`
  returns null for it.
- **Frontmatter units differ:** `market_risk`/`compensation` are `"16.98%"` strings,
  `retained_reserve`/`target_interest_rate` are fractions (`0.25`, `0.0075`) — `lib/normalize.ts`
  turns everything into percents; `Assessment.raw` keeps the verbatim object for diffs.
- Real assessment files don't always follow the template headings (e.g. no `## Tail Risks`
  wrapper) — never key logic on heading text.
- `/prices/list` may list a token twice (cbBTC); the map is keyed by address so last write wins.
- Slugs are lowercase tickers; route params are validated with `lib/slug.ts` before any lookup and
  must exist in the index — nothing from the request reaches an upstream URL.
- `isomorphic-dompurify` pulls jsdom; first import is slow (~1 s) but that's once per process.

## Cross-repo

- Assessments repo: proposing a change there? Keep `templates/collateral-assessment-template.md`,
  `schema/collateral-assessment.schema.json` and this repo's `lib/frontmatter.ts` consistent. The
  planned additions are optional `links.discussion` and top-level `blocks` (both already tolerated
  here).
- Shared protocol constants (chain ids, ZCHF/FPS addresses) are documented authoritatively in
  `../frankencoin-mcp/CLAUDE.md`.
- Fixtures in `test/fixtures/` are real snapshots of the repo files and API responses; refresh them
  with the curl commands in `README.md` when upstream shapes change.
