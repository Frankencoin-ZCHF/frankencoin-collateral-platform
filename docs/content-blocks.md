# Content blocks

Assessment authors can add live data, documents, charts and notes to a collateral page
**without touching this codebase** — straight from the assessment markdown in the
[frankencoin-collateral-assessments](https://github.com/Frankencoin-ZCHF/frankencoin-collateral-assessments)
repository.

## How to declare a block

Put a fenced code block with the info string `block` anywhere in the narrative. The body
is a few lines of YAML. GitHub shows it as a plain code block; the platform renders it as
a live component **at that exact position**:

````markdown
## Public Information

```block
type: documents
title: Key documents
items:
  - label: Audit report (Q1 2026)
    url: https://example.com/audit.pdf
    kind: audit
  - label: Legal opinion
    url: https://example.com/legal.pdf
    date: 2026-03-01
```
````

Blocks that should sit in a dedicated **"Additional data"** section (after the system
blocks, not inline) go into the JSON frontmatter instead:

```json
"blocks": [
  { "type": "defillama", "protocol": "lido" },
  { "type": "coingecko", "show": ["price", "market_cap", "ath_change"] }
]
```

Rules:

- Every block needs a `type:`. Unknown types or invalid fields render an inline
  *"Unrenderable block"* notice (and show up in `/health` → `contentBlockIssues`); they never
  break the page.
- URLs you declare are fetched **server-side** with an SSRF guard: `https://` only, no
  private/loopback addresses, 5 s timeout, 1 MB cap, cached 5 minutes. Operators can restrict
  hosts with `BLOCK_FETCH_ALLOWED_HOSTS`.
- Because the declaration lives in the `.md`, it is versioned and diffed like the rest of
  the assessment.

## Types

### `type: documents` (alias `type: links`)

A titled list of links.

| field | required | notes |
|---|---|---|
| `title` | no | defaults to "Documents" / "Links" |
| `description` | no | |
| `items[]` | yes | 1–50 entries |
| `items[].label` | yes | |
| `items[].url` | yes | any URL |
| `items[].description` | no | |
| `items[].date` | no | free text |
| `items[].kind` | no | `pdf` `web` `audit` `legal` `report` `code` `other` (icon) |

### `type: callout`

A highlighted note. Markdown allowed in `text`.

| field | required | notes |
|---|---|---|
| `text` | yes | up to 4000 chars |
| `title` | no | |
| `variant` | no | `note` (default) `warning` `success` `danger` |

### `type: coingecko`

Market data from CoinGecko.

| field | required | notes |
|---|---|---|
| `id` | no | coin id (`coingecko.com/en/coins/<id>`); defaults to the assessment's `links.coingecko` |
| `title` | no | |
| `show` | no | any of `price` `change_24h` `change_7d` `change_30d` `market_cap` `fdv` `volume_24h` `ath` `ath_change` `circulating_supply` `total_supply` `rank` |

### `type: defillama`

Current TVL + chain breakdown of a protocol.

| field | required | notes |
|---|---|---|
| `protocol` | yes | slug from `defillama.com/protocol/<slug>` |
| `title` | no | |

### `type: api`

One or more values from any public JSON endpoint.

| field | required | notes |
|---|---|---|
| `url` | yes | https only |
| `title` | no | |
| `path` | single value | dot-path into the response, e.g. `data.apr` or `items[0].value` (omit for the root) |
| `label` | single value | |
| `format` | no | `auto` `number` `number:0` `percent` `percent:1` `currency:CHF` `currency:USD` `compact` `text` `date` `datetime` |
| `unit` | no | appended to the value |
| `items[]` | several values | each with `label`, `path`, `format`, `unit` |
| `source`, `link` | no | attribution |

```block
type: api
title: Lido staking APR
url: https://eth-api.lido.fi/v1/protocol/steth/apr/last
path: data.apr
format: percent
```

### `type: table`

| field | required | notes |
|---|---|---|
| `columns[]` | yes | `key` (dot-path per row), `label`, `format`, `align` |
| `rows[]` | or `url` | inline objects |
| `url` + `path` | or `rows` | JSON endpoint and dot-path to the array |
| `limit` | no | default 50, max 200 |
| `title`, `source` | no | |

### `type: chart`

Line / bar / horizontal bar / donut from inline `data` or a JSON endpoint.

| field | required | notes |
|---|---|---|
| `x` | yes | field with the category / date (unix s, unix ms or ISO) |
| `y` | yes | field, or list of fields for several series |
| `kind` | no | `line` (default) `bar` `hbar` `donut` |
| `data[]` | or `url` | inline points |
| `url` + `path` | or `data` | JSON endpoint and dot-path to the array |
| `unit`, `limit`, `title`, `source` | no | `limit` keeps the last N points (default 365) |

### `type: embed`

An iframe from an allow-listed host only: `dune.com`, `defillama.com`, `youtube.com`.

| field | required | notes |
|---|---|---|
| `url` | yes | https; `youtube.com/watch?v=` links are converted to embeds |
| `title`, `height` | no | height 120–1200 px, default 420 |

## Adding a new type (developers)

1. Create `src/blocks/content/types/<type>/index.ts` exporting a `ContentBlockType`
   (`type`, `description`, zod `schema`, `load`, `Component`) and `Block.astro`.
2. Register it in `CONTENT_BLOCK_TYPES` in `src/blocks/content/registry.ts`.
3. Document it here — `test/content-blocks.test.ts` fails if a registered type is missing
   from this file.

Fetch author-supplied URLs only through `safeFetchJson` in `src/upstream/generic.ts`.
