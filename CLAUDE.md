# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **Frankencoin Collateral Platform** (`collateral.frankencoin.com`): one place for everything
about the assets that back Frankencoin (ZCHF) — the risk assessments maintained as markdown in
`Frankencoin-ZCHF/frankencoin-collateral-assessments`, live on-chain data from `api.frankencoin.com`,
GitHub-discussion threads, and version history/diffs of each assessment.

Server-rendered Astro 7 (`@astrojs/node` 11, standalone) + Tailwind 4 + Alpine, TypeScript. (Astro 7,
not the site's Astro 5: every Astro 5 release carries unpatched XSS advisories — `yarn audit` is a CI
gate.) Design tokens, fonts and layout components are **copied from `../frankencoin-site`** — keep
them visually in sync rather than diverging. Read-only, public, no auth, no database: an in-memory cache in front of
upstream APIs is the only state.

## Commands (yarn — not npm)

```bash
yarn install
yarn dev                 # http://localhost:3000 (PORT env overrides)
yarn dev:offline         # no network: assessments from a local clone + protocol fixtures (.env.offline)
yarn build && yarn start # production: node ./dist/server/entry.mjs
yarn run check           # astro check (plain `yarn check` checks dependencies)
yarn audit --level moderate   # must be clean — CI fails otherwise
yarn test                # vitest, all suites
yarn test test/protocol.test.ts    # one file
yarn test -t "matchThreads"        # one test name
```

Env vars are all optional (`.env.example`). **Offline / test environment:** `yarn dev:offline` runs
`astro dev --mode offline`, which loads `.env.offline`: `ASSESSMENTS_LOCAL_PATH` points at a local git
clone of the assessments repo (`src/upstream/localgit.ts` serves tree/files/history via `git`, so
version diffs work offline) and `PROTOCOL_FIXTURES_DIR=./test/fixtures` serves the API JSON
fixtures. Discussions and CoinGecko degrade. `/health` reports `mode: "offline"`. `GITHUB_TOKEN` matters most: without it, discussions
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
- `src/services/protocol.ts` — headline figures (minted, aggregate limit, remaining capacity,
  open/requested/closed/denied counts, TVL) come from `/ecosystem/collateral/stats`, the protocol's
  authoritative aggregate. `/positions/list` (V1+V2) is grouped by collateral only for the position
  table and `computeSafety()` (liquidation buffers, debt near liquidation), and is **reconciled**
  against the aggregate — divergence (e.g. CHFAU's open position missing from the feed) is flagged,
  never hidden. Never sum per-position `availableForClones`/`availableForMinting`: clones repeat
  their parent's capacity, so the sum overstates several-fold.
- `src/services/collaterals.ts` — `join()` unions assessed and live collaterals **by contract
  address only**. An assessment whose address matches nothing is never merged with a same-symbol
  token: it stays assessment-only with an `address-mismatch` issue pointing at the live record.
  `deriveLifecycle()` gives every record a collateral lifecycle (draft/proposed/live/closed/denied)
  from protocol counts — independent of the assessment stage. `issuesFor()` produces integrity
  issues (price freshness, feed divergence, missing or unavailable assessments). `summarize()` feeds the
  KPIs. Unlisted tokens with no active positions (ZEUS/HPS…) are dropped.
- `src/services/bridges.ts` — **VCHF and CHFAU are not collaterals but 1:1 StablecoinBridge minters** (discovered
  from Ponder `frankencoinMinters` with "bridge" in the application message; `horizon/limit/minted/chf` read
  on-chain via `upstream/eth.ts`, offline via `test/fixtures/bridges.json`). Attached as `LiveCollateral.bridge`:
  the contract is authoritative for minted/limit, there is no safety/utilisation, lifecycle is
  live/closed(expired)/proposed, and the detail page shows the `bridge` block instead of the position
  blocks. Risk = source-stablecoin issuer/peg/freeze risk up to `minted`; `bridge-peg` (>1 % off 1 CHF)
  is a live-queue issue, "expires in ≤60 days" a review item. Selectors are verified by test/bridges.test.ts.
- `src/services/comparison.ts` — compares individual active positions with the assessment;
  verdicts distinguish exact matches, display tolerance, conservative uniform values, varied
  positions and differences. Each row lists differing position links and their outstanding debt.
- `src/services/monitoring.ts` — reference-price quality, exposure-weighted monitoring coverage,
  asset-category concentration, and static price-drop scenarios. Freshness windows are explicit
  UI monitoring settings in `src/lib/assets.ts` (1 hour for crypto/bridges, 24 for gold/unknown,
  72 for shares/ETF exposure), not guarantees of liquidity. Taxonomy uses contract identity.
  Scenario debt is static threshold exposure, never a loss forecast; assume 1 ZCHF = 1 CHF.
- `src/services/lending.ts` — reserve-adjusted effective interest, reserve requirement / outside-reserve
  debt split, aggregate overcollateralisation and minting-limit use. Effective interest is the whole
  annual gross fee rate divided by `(1 - reserve fraction)`, not the raw contract premium. Effective
  averages weight by debt outside the reserve; reserve averages weight by gross debt. Missing rates
  remain unavailable. Reserve splits require reconciled feeds (allowing integer rounding only) and
  describe nominal requirements before fees, not actual redeemable balances or circulating supply.
- `src/services/insights.ts` — shared price drivers, mutually exclusive debt-expiry buckets, and
  assessment actions ordered by outstanding exposure. Bridge minting horizons are not loan maturities.
- `src/services/discussions.ts` — GraphQL only (needs token). Thread resolution: explicit
  `links.discussion` URL in the frontmatter → else `matchThreads()` heuristic on the
  "Acceptable Collaterals" category titles.
- `src/lib/frontmatter.ts` mirrors the assessments repo's `scripts/validate.js` delimiter logic
  (`---` … `indexOf("---", 3)`) and its JSON schema as zod, kept `.loose()` so new keys such as
  `links.discussion` / `blocks` pass through — with output-oriented rules on display fields
  (ticker/name/author: no `<>`/control chars; address/date formats). `buildAssessment()` also
  rejects *published* files with a future date or missing address. `index()` resolves the ref to
  one commit sha first and reads the tree and every file at that sha (coherent snapshot).

### Security boundaries

- Data → markup: `jsonForScript()` for `<script type="application/json">`, `escapeHtml()`/DOM
  nodes in AG Grid renderers, DOMPurify for markdown and GitHub HTML. Never `set:html` raw
  `JSON.stringify` output.
- CSP (`src/middleware.ts`): production `script-src 'self' 'unsafe-eval'` — **no inline scripts**
  (use Alpine attributes or module scripts); `'unsafe-eval'` is Alpine's expression evaluator.
  `vite.build.assetsInlineLimit: 0` keeps Astro from inlining small module scripts at build time.
- Author URLs (content blocks): only via `safeFetchJson` in `src/upstream/generic.ts` — an undici
  agent whose DNS lookup rejects private ranges at connect time, manual redirects re-validated per
  hop, and a production host allowlist (`DEFAULT_ALLOWED_HOSTS` / `BLOCK_FETCH_ALLOWED_HOSTS`).

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

Basic browsing uses a six-column SSR table plus lightweight `overview.ts` filters; URL parameters
preserve search, asset category, sort and view. Current backing includes any outstanding debt even if
minting has ended. AG Grid loads only when “Advanced data & export” opens (`grid-loader.ts`).
`charts-loader.ts` imports ECharts when a detail-page `[data-chart]` scrolls into view.
`detail-navigation.ts` opens disclosures for deep links. Alpine is bundled from npm (no CDN).

## Gotchas

- Runtime: Node ≥ 22.22.2 (`isomorphic-dompurify` engine constraint); `.nvmrc`/`.node-version` pin
  26 for Railway and CI. Never install with `--ignore-engines`.

- **Number encodings:** token amounts are BigInt strings → `fromWei(v, decimals)`; position
  liquidation prices are scaled by `36 - decimals`; `riskPremiumPPM`/`reserveContribution` are PPM
  → `ppmToPercent`. V2 positions carry both `riskPremiumPPM` (premium) and `annualInterestPPM`
  (gross annual fee rate); V1 only has `annualInterestPPM` and no separate premium. Both need
  the retained-reserve adjustment to be comparable with assessed effective interest. The `cooldown` field can be 2^256 — `isoFromUnix`
  returns null for it.
- **Frontmatter units differ:** `market_risk`/`compensation` are `"16.98%"` strings,
  `retained_reserve`/`target_interest_rate` are fractions (`0.25`, `0.0075`) — `lib/normalize.ts`
  turns everything into percents; `Assessment.raw` keeps the verbatim object for diffs.
- raw.githubusercontent.com answers in 4–8 s per file; `upstream/github.ts` limits raw fetches to 4 in flight with a 20 s timeout. A partial index (transient fetch failures) is dropped from the cache after 30 s and the affected collaterals show "assessment temporarily unavailable" instead of "no assessment".
- Findings share one model in THREE queues (`services/attention.ts`): `live` = financial
  observations (challenges, debt near liquidation, peg changes); `data` = unavailable, stale,
  unverified or divergent data; `review` = missing assessments, parameter differences, governance
  references and bridge expiry. Publication is not governance approval. All views derive their
  counts from this model, including active challenges that cannot be attributed to a collateral.
  Queue-specific hashes (`#data-wbtc`, etc.) open the relevant group; legacy slug hashes still work.
- Missing/stale/future-dated prices must never produce a reassuring monitoring status. Compare
  source observation time, not response fetch time. Coverage excludes incomplete sources and
  positions without liquidation prices. A valid active financial alert stays visible with its
  data limitations. Asset descriptions and excerpts must preserve source meaning and sanitisation.
- Timestamp ordering is NOT an integrity rule: assessment date, commit time and live fetch time are separate provenance clocks. A future assessment date is a note beside the date (likely typo), never an attention item — but a *published* assessment with a future date is rejected at parse time.
- Comparison wording depends on the assessment stage (`compareParameters(..., status)`): use "draft proposal", "published assessment" or "archived assessment". Display tolerances are not governance rules.
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
