---
{
  "asset_name": "Wrapped Bitcoin",
  "asset_ticker": "WBTC",
  "contract_address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "assessment_date": "2026-11-03",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "https://etherscan.io/token/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "coingecko": "https://www.coingecko.com/en/coins/wrapped-bitcoin",
    "website": "https://wbtc.network/",
    "docs": "https://docs.wbtc.network/overview/wbtc-overview",
    "other": "https://docs.wbtc.network/overview/proof-of-reserve-and-transparency-dashboard"
  },
  "risk_scores": {
    "public_information": "Strong",
    "free_float": "Strong",
    "market_risk": "16.68%",
    "tail_risks": {
      "counterparty_risks": [
        {
          "name": "BitGo/BiT Global",
          "probability": "Low",
          "severity": "Severe",
          "compensation": "0.50%"
        }
      ],
      "smart_contract_risks": [
        {
          "name": "Smart-Contract Exploit",
          "probability": "Very Low",
          "severity": "Severe",
          "compensation": "0.25%"
        }
      ],
      "governance_risks": [
        {
          "name": "Admin-Control",
          "probability": "Negligible",
          "severity": "n/a",
          "compensation": "0%"
        }
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": 0.20,
    "target_interest_rate": 0.0075,
    "global_minting_limit": "no limit",
    "maturity": "3 years",
    "auction_duration": 24
  }
}
---

# Collateral Risk Assessment: Wrapped Bitcoin

## Summary

WBTC is an ERC-20 representation of Bitcoin. It provides liquid BTC exposure on Ethereum, and the proposed 20% retained reserve provides a reasonable buffer above the 16.68% worst 48-hour close-to-close drawdown observed over the two-year assessment window.

The residual risks arise from the WBTC custody and redemption structure, the token-contract architecture, and the contract's admin functions.

## Asset Overview

WBTC represents BTC held in custody by BitGo and BiT Global and is issued on Ethereum through a custodian-and-merchant model. Approved merchants support the minting and redemption process. The collateral exposure is primarily Bitcoin market risk, with additional custody, redemption and token-contract dependencies.

## Free Float

Classification: Strong

WBTC has deep secondary-market liquidity and broad integration across centralised and decentralised venues. Independent challengers and auction buyers can acquire and sell the token without relying on a single marketplace.

## Public Information

Classification: Strong

WBTC publishes reserve and supply information, has a long operating history, and trades in transparent secondary markets. Challengers can reasonably assess the asset and auction outcomes.

## Market Risk

99%-VaR, 48h close-to-close: 8.11%

Worst historical 48h close-to-close drawdown: 16.68%

The metrics use two years of daily close data. A 20% retained reserve exceeds the observed worst 48-hour drawdown and provides additional room for challenger reward and auction execution.

## Tail Risks

### Counterparty Risk: BitGo/BiT Global

Likelihood: Low

Severity: Severe

Compensation: 0.50%

WBTC depends on the combined BitGo, BiT Global and merchant custody/redemption structure. It is more operationally complex than a single-issuer wrapper such as cbBTC. A custody, operational or recovery failure could impair the recoverable value of WBTC even if Bitcoin itself remains valuable.

### Smart-Contract Risk: Smart-Contract Exploit

Likelihood: Very Low

Severity: Severe

Compensation: 0.25%

WBTC uses a mature, non-upgradeable ERC-20 contract. It includes mint, burn, global pause and unpause, finish-minting, ownership-transfer and token-recovery functions. These controls are expected for a centrally issued BTC wrapper. The technical premium covers an exploit or accounting failure that independently impairs balances or transferability.

### Governance Risk: Admin-Control

Likelihood: Negligible

Severity: n/a

Compensation: 0%

The owner can pause and unpause transfers, control minting until minting is permanently finished, transfer ownership, and recover unrelated ERC-20 tokens sent to the contract. The contract has no address-level blacklist, freeze or arbitrary holder-seizure function. A global pause alone does not warrant a separate governance premium.

## Conclusion

The 20% retained reserve provides a reasonable buffer against the 16.68% worst 48h close-to-close drawdown observed over the two-year assessment window. The 0.75% effective interest rate compensates the assessed tail risks. The framework does not require a cap on the global minting limit based on the tail risk analysis; WBTC’s high liquidity supports a 24-hour auction duration, and its established market position makes a maturity of 3 years reasonable before the collateral needs to be reassessed.
