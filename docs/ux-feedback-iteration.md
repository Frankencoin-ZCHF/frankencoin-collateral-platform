# UX feedback iteration

This follows the review in “Feedback Collateral Risk Platform”. The public interface now starts with the assets and their lending terms, with operational detail available on demand.

## Feedback addressed

- Replaced the overview hero and duplicate protocol totals with compact, clickable asset categories. Category names are consistent in filters, rows and asset headers.
- Made asset links explicit. Added sorting by exposure, name, aggregate overcollateralisation and effective interest. Search, categories and sorting work through server-rendered URLs; JavaScript updates the same table in place.
- Replaced the weakest position's cushion in the overview with aggregate overcollateralisation. Individual cushions remain in the asset's position section.
- Exposed retained reserves, effective annual interest, and global minting limits directly in the overview. The exposure cell separates nominal minter-reserve requirements from the amount outside that reserve.
- Removed the decision panel from asset pages. The assessment comes first, integrating current and assessed lending terms. Tail risks follow immediately, expanded, without the expected-loss column or a duplicate target-premium card. Detailed position comparisons are under Sources & history.
- Replaced the main monitoring presentation with portfolio concentration, shared price exposures, debt-expiry buckets and assessment actions ordered by outstanding exposure. Existing monitoring deep links still work; position management links to the main app.
- Preserved the risk framework, discussions, version comparisons, source provenance, price scenarios and lazy-loaded advanced data export.

## Financial definitions

- **Average overcollateralisation** = aggregate reported collateral value / gross outstanding debt − 1. For 174 CHF of collateral and 100 ZCHF of debt, the display is +74%. It is not the smallest position's price cushion. Calculations assume 1 ZCHF = 1 CHF.
- **Effective annual interest** = annual fee rate on gross debt / (1 − reserve fraction). The V2 annual fee rate includes the base rate and raw contract premium. The assessment's compensation total represents effective interest, not the contract premium. V1 has a total annual fee rate but no separately observable premium.
- **Ranges** span open positions. Effective-rate averages weight by debt outside the retained reserve; reserve averages weight by gross debt. Missing rates do not become zero or fall back to a raw premium.
- **Reserve split** uses the nominal reserve requirement on each open position. It is suppressed when the position feed does not reconcile, allowing the API's integer truncation within 1 ZCHF. The outside-reserve figure is before fees; it is not protocol circulating supply. Redeemable reserves can be lower after losses.
- **Minting limits** use the protocol aggregate. Clone capacity fields are never summed.
- **Expiry buckets** count each funded open position once. Missing dates have their own bucket. A bridge's minting horizon is not a loan repayment deadline.

Sources checked: the assessment framework's Parameter Calibration section, `PositionV2.annualInterestPPM` and `getUsableMint`, and `Frankencoin.calculateAssignedReserve` in the official Frankencoin contracts.

## Verification

- 118 unit tests, including effective-rate conversion, reserve weighting, incomplete feeds, aggregate backing, expiry boundaries and assessment priorities.
- Astro type checking and production build.
- Dependency audit: no vulnerabilities.
- Offline production-server checks with protocol fixtures and a local assessment clone: overview filters and sorting, collateral/bridge pages, assessment-first order, expanded tail risks, sources, historical assessments, comparisons, JSON API and health endpoint. Checked heading/ARIA references, deep links and the absence of inline executable scripts.

Full browser visual and interaction checks remain outstanding because browser access to the local server is restricted in the implementation environment. The production checks verify returned HTML and data, not pixel layout.

## Follow-up: platform context and assessment reading

- Added a short platform introduction and renamed “Compare assets” to “Asset overview”.
- Restored the author's complete executive summary above quantitative data, with assessment author, date and stage. Nonstandard reports use a clearly labelled opening excerpt; historical pages use their selected assessment.
- Made the full assessment a visible section with a prominent link near the summary, a contents list on the left on desktop (above the chapters on mobile), and individually expandable chapter titles. Readers can expand or collapse all chapters; each chapter remains accessible without JavaScript.
- Kept report chapter anchors separate from quantitative section anchors, updated internal report links, and retained legacy deep-link handling.
- Verified with 123 unit tests, Astro checking, a production build and offline production HTML checks covering long summaries, historical assessments, chapter contents links and unassessed bridges. The browser verification limitation above still applies.

## Follow-up: invite community participation

The detail-page hero now includes a community widget beside the asset heading on desktop and above the executive summary on mobile. It invites questions, evidence and improvements, linking directly to the existing discussion. It reuses the discussion block's resolution without additional requests, keeps declared links usable during API failures, and labels the forum fallback separately when no thread is known. Historical assessments link to the current community discussion.
