# Frankencoin Collateral Platform

The public home of everything about the assets that back **Frankencoin (ZCHF)** —
[collateral.frankencoin.com](https://collateral.frankencoin.com).

- **Overview & dashboard** — every collateral that is assessed and/or live on-chain, with a
  filterable, sortable, exportable table combining assessment data and live protocol data.
- **Detail page per collateral** — a decision panel (collateral lifecycle and assessment stage as two
  independent states, debt, minimum liquidation buffer, deviations, provenance with separate clocks
  for the assessment snapshot and the live protocol state), the full risk assessment,
  assessed-vs-on-chain parameters with named verdicts, position safety, live positions and
  challenges, the community discussion thread, and the complete **version history** with
  structured + text diffs between any two versions.
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
yarn dev:offline          # no network: local clone of the assessments repo + JSON fixtures (see .env.offline)
yarn check                # astro check
```

Machine-readable endpoints: `/api/collaterals.json`, `/api/collateral/<ticker>.json`, `/health`.

## Deployment

Node ≥ 22.22.2 (pinned to 26 via `.nvmrc`); standalone server; `PORT` is honoured. On Railway/nixpacks the `build` and `start` scripts are
picked up automatically and `/health` is the health check (see `railway.json`). Set `SITE` to the
public origin and `GITHUB_TOKEN` (read-only, `public_repo` + `read:discussion`).

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
```

## License

MIT
