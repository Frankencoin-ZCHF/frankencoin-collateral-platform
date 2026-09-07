/**
 * Static protocol constants. Pure data — no I/O. Upstream hosts are hard-coded here
 * and nowhere else, so no client-supplied value can influence an outbound destination
 * (the one exception, author-declared content-block URLs, goes through the SSRF guard
 * in upstream/generic.ts).
 */

export const API_BASE = "https://api.frankencoin.com";
export const PONDER_BASE = "https://ponder.frankencoin.com";
export const GITHUB_API = "https://api.github.com";
export const GITHUB_RAW = "https://raw.githubusercontent.com";
export const GITHUB_WEB = "https://github.com";
export const CG_PRO_BASE = "https://pro-api.coingecko.com/api/v3";
export const CG_PUBLIC_BASE = "https://api.coingecko.com/api/v3";
export const DEFILLAMA_BASE = "https://api.llama.fi";
export const APP_URL = "https://app.frankencoin.com";
/** Public Ethereum JSON-RPC endpoints, tried in order. */
export const ETH_RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com", "https://eth.drpc.org"];
export const ETHERSCAN = "https://etherscan.io";

/** Folders inside the assessments repo, in precedence order when a ticker exists in several. */
export const ASSESSMENT_STATUSES = ["published", "draft", "deprecated"] as const;
export const ASSESSMENTS_DIR = "assessments";
export const FRAMEWORK_PATH = "framework/collateral-risk-framework.md";
export const TEMPLATE_PATH = "templates/collateral-assessment-template.md";
/** Files inside the assessment folders that are not assessments. */
export const ASSESSMENT_IGNORED_FILES = new Set(["example.md", ".gitkeep", "README.md"]);

/** GitHub Discussions category holding collateral proposals. */
export const DISCUSSION_CATEGORY_SLUG = "acceptable-collaterals";
export const DISCUSSION_CATEGORY_NAME = "Acceptable Collaterals";

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  100: "Gnosis",
  137: "Polygon",
  146: "Sonic",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
};

export function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

/** ZCHF on Ethereum mainnet (positions/minting live here). */
export const ZCHF_ETHEREUM = "0xb58e61c3098d85632df34eecfb899a1ed80921cb";

/** Tail-risk categories in the order the framework lists them. */
export const TAIL_RISK_CATEGORIES = [
  "counterparty_risks",
  "smart_contract_risks",
  "governance_risks",
  "legal_risks",
  "liquidity_risks",
  "contagion_risks",
] as const;

export const TAIL_RISK_LABELS: Record<(typeof TAIL_RISK_CATEGORIES)[number], string> = {
  counterparty_risks: "Counterparty risk",
  smart_contract_risks: "Smart-contract risk",
  governance_risks: "Governance risk",
  legal_risks: "Legal risk",
  liquidity_risks: "Liquidity risk",
  contagion_risks: "Contagion risk",
};

/** Framework scales (framework/collateral-risk-framework.md). */
export const CLASSIFICATIONS = ["Strong", "Sufficient", "Insufficient"] as const;
export const PROBABILITY_LEVELS = ["Negligible", "Very Low", "Low", "Medium", "High"] as const;
export const SEVERITY_LEVELS = ["Moderate", "Severe", "Critical"] as const;

/** Annual probability (%) and loss severity (%) per framework level — used for display only. */
export const PROBABILITY_PCT: Record<string, number> = {
  negligible: 0.25,
  "very low": 0.5,
  low: 1,
  medium: 3.5,
  high: 7.5,
};
export const SEVERITY_PCT: Record<string, number> = {
  moderate: 25,
  severe: 50,
  critical: 100,
};
