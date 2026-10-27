# Frankencoin Collateral Platform

The public home of everything about the assets that back **Frankencoin (ZCHF)** —
[collateral.frankencoin.com](https://collateral.frankencoin.com).

- **Overview** — outstanding exposure, estimated backing and active challenges, followed by
  underlying-asset concentration and a six-column asset list. Search and filter current backing,
  proposals/unused facilities or archived assets. The advanced table and CSV export load on demand.
- **Collateral detail** — an asset description, the author's opening assessment, exposure and
  price cushion; then positions, assessment findings, and changes/sources. Static price-drop
  scenarios quantify debt beyond configured liquidation prices, not losses or auction outcomes.
- **Monitoring & review** — separate financial observations, data-quality limitations and
  assessment findings. Coverage is weighted by outstanding debt. Reference-price observation
  times remain separate from fetch times; published assessments do not imply governance approval.
- **Parameter comparison & history** — compare individual position settings with the assessment,
  including differing position counts and debt. Full assessment versions have structured and text diffs.
- **Extensible blocks** — assessment authors add documents, CoinGecko/DefiLlama data, generic API
  values, tables, charts or embeds straight from the assessment markdown
  (see [`docs/content-blocks.md`](docs/content-blocks.md)).

## Data sources

| Source | Used for |
|---|---|
| [frankencoin-collateral-assessments](https://github.com/Frankencoin-ZCHF/frankencoin-collateral-assessments) | assessments (`assessments/{draft,published,deprecated}/*.md`), framework, version history |
| [api.frankencoin.com](https://api.frankencoin.com) | collateral aggregates (`/ecosystem/collateral/stats`), prices, positions, challenges |
| [GitHub Discussions](https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/categories/acceptable-collaterals) | community threads per collateral |
| CoinGecko / DefiLlama / any public JSON | optional enrichment via content blocks |

Everything is fetched live on request and cached in memory (TTL + stale-while-revalidate). There is no
database.

## Running

```bash
yarn install
cp .env.example .env      # optional — set GITHUB_TOKEN for discussions + history quota
yarn dev                  # http://localhost:3000
yarn build && yarn start  # production (node ./dist/server/entry.mjs)
yarn test                 # unit tests (vitest)
yarn audit                # all severities must pass, as enforced in CI
yarn dev:offline          # no network: local clone of the assessments repo + JSON fixtures (see .env.offline)
yarn run check            # astro check (plain `yarn check` checks dependency integrity)
```

Machine-readable endpoints: `/api/collaterals.json`, `/api/collateral/<ticker>.json`, `/health`.

Dependencies are refreshed to the latest stable releases as of 2026-10-27, with transitive
dependencies resolved within their upstream compatibility constraints. TypeScript stays on
the newest supported 6.x release (6.0.3): Astro 7.4.2's `astro check` rejects TypeScript 7.0,
and its experimental replacement requires TypeScript 7.1+. CI keeps full type checking and
fails on any dependency advisory or audit error; there are no advisory exceptions.

## Deployment

Node 26.x, aligned across `package.json`, `.nvmrc`, and `.node-version`; standalone server;
`PORT` is honoured. Railway uses Railpack to install dependencies from `yarn.lock`, then runs
`yarn build`. The start command and `/health` health check are configured in `railway.json`.
Set `SITE` to the public origin and `GITHUB_TOKEN` (read-only, `public_repo` + `read:discussion`).

Railpack reads `engines.node` before `.nvmrc`, so keep these version settings aligned. No Node
version override is needed in Railway; if `RAILPACK_NODE_VERSION` is already set, remove it or
set it to `26`. Do not switch back to Nixpacks: its pinned Node 24.10.0 is below the Node 24.15.0
minimum required by the locked `isomorphic-dompurify` version.

## Refreshing test fixtures

```bash
R=https://raw.githubusercontent.com/Frankencoin-ZCHF/frankencoin-collateral-assessments/main
curl -so test/fixtures/wstETH.md $R/assessments/draft/wstETH.md
curl -so test/fixtures/WBTC.md   $R/assessments/draft/WBTC.md
curl -so test/fixtures/template.md $R/templates/collateral-assessment-template.md
A=https://api.frankencoin.com
curl -so test/fixtures/positions.json $A/positions/list
curl -so test/fixtures/prices.json $A/prices/list
curl -so test/fixtures/collaterals.json $A/ecosystem/collateral/list
curl -so test/fixtures/challenges.json $A/challenges/list
curl -so test/fixtures/stats.json $A/ecosystem/collateral/stats
# bridges.json (StablecoinBridge minters + on-chain horizon/limit/minted): see scripts/capture-bridges.mjs
```

## License

MIT
