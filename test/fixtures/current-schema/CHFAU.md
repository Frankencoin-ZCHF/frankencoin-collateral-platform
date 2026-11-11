---
{
  "asset_name": "AllUnity CHF",
  "asset_ticker": "CHFAU",
  "contract_address": "0xbd4dfc058eb95b8de5ceaf39966a1a70f5556f78",
  "assessment_date": "2026-11-05",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "https://etherscan.io/token/0xbd4dfc058eb95b8de5ceaf39966a1a70f5556f78",
    "coingecko": "https://www.coingecko.com/en/coins/allunity-chf",
    "website": "https://allunity.com/chfau/",
    "docs": "https://allunity.com/chfau/",
    "other": "https://www.allunity.com/"
  },
  "risk_scores": {
    "public_information": "Strong",
    "free_float": "Sufficient",
    "market_risk": "0%",
    "tail_risks": {
      "counterparty_risks": [{"name": "AllUnity", "probability": "Negligible", "severity": "n/a", "compensation": "0%"}],
      "smart_contract_risks": [{"name": "Smart-Contract Exploit", "probability": "Negligible", "severity": "n/a", "compensation": "0%"}],
      "governance_risks": [{"name": "Admin-Control", "probability": "Negligible", "severity": "n/a", "compensation": "0%"}]
    }
  },
  "risk_parameters": {
    "retained_reserve": 0,
    "target_interest_rate": 0,
    "global_minting_limit": 10000000,
    "maturity": "1 year",
    "auction_duration": 0
  }
}
---

# Collateral Risk Assessment: AllUnity CHF

## Summary

CHFAU is AllUnity's Swiss franc e-money token. AllUnity describes CHFAU as a MiCAR-regulated token, pegged one-to-one to CHF and backed by segregated reserves.

There is no ordinary market-price risk relative to ZCHF, so no retained reserve is required for CHF/CHF price movements. The residual exposure is to AllUnity's reserve, issuance and redemption operations and to the token's centrally administered, upgradeable smart-contract stack. The 10,000,000 ZCHF global minting limit is the primary exposure control.

## Asset Overview

CHFAU is a CHF-denominated ERC-20 token issued by AllUnity. AllUnity states that CHFAU is pegged one-to-one to the Swiss franc and backed by segregated reserves. Its value proposition is CHF settlement and treasury liquidity on public blockchain infrastructure.

CHFAU is an e-money token. Holders' recovery depends on AllUnity's reserve management and its issuance and redemption process under the applicable terms and regulatory framework.

## Free Float

Classification: Sufficient

CHFAU has direct issuance and redemption routes through AllUnity's institutional distribution and onboarding framework, alongside observable secondary-market access. Independent challengers and auction buyers can acquire and sell CHFAU without relying on a single marketplace.

## Public Information

Classification: Strong

CHFAU has a transparent one-to-one CHF reference, public token-contract information and issuer documentation on its reserve-backed structure. These sources provide a reliable basis to estimate expected auction outcomes.

## Market Risk

Worst 48h close-to-close drawdown observed over the two-year assessment window: 0%

CHFAU and ZCHF are both CHF-denominated. No retained reserve is required for ordinary CHF/CHF market movements.

## Tail Risks

### Counterparty Risk: AllUnity

Likelihood: Negligible

Severity: n/a

Compensation: 0%

AllUnity is the central issuer and operates the reserve, issuance and redemption framework underlying CHFAU. To ensure 1:1 conversions between CHFAU and ZCHF through the stablecoin bridge, this risk is classified as negligible.

### Smart-Contract Risk: Smart-Contract Exploit

Likelihood: Negligible

Severity: n/a

Compensation: 0%

CHFAU is represented by an Ethereum token contract. The deployed token uses an upgradeable proxy architecture, so technical integrity depends on both the proxy and its implementation. To ensure 1:1 conversions between CHFAU and ZCHF through the stablecoin bridge, this risk is classified as negligible.

### Governance Risk: Admin-Control

Likelihood: Negligible

Severity: n/a

Compensation: 0%

CHFAU's upgradeable, centrally administered token architecture creates an administrative control surface. A pledged CHFAU balance can be made non-transferable through blacklisting, and subsequently burned if the blacklist-burn authority is exercised. The token can also be globally paused or have its logic changed through upgrade authority. To ensure 1:1 conversions between CHFAU and ZCHF through the stablecoin bridge, this risk is classified as negligible.

## Conclusion

No retained reserve is required for ordinary CHF/CHF market movements and the effective interest rate is 0% to ensure 1:1 conversions. The 10,000,000 ZCHF global minting limit is the principal safeguard against issuer and operational dependency.
