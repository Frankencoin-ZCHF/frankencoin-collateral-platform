---
{
  "asset_name": "Wrapped Bitcoin",
  "asset_ticker": "WBTC",
  "contract_address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "assessment_date": "2026-08-01",
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
          "name": "BitGo + Merchant network",
          "probability": "Very Low",
          "severity": "Severe",
          "compensation": "0.25%"
        }
      ],
      "smart_contract_risks": [
        {
          "name": "Smart Contract Exploit",
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
      ],
      "legal_risks": [
        {
          "name": "n/a",
          "probability": "n/a",
          "severity": "n/a",
          "compensation": "n/a"
        }
      ],
      "liquidity_risks": [
        {
          "name": "Redemption Failure",
          "probability": "Negligible",
          "severity": "n/a",
          "compensation": "0%"
        }
      ],
      "contagion_risks": [
        {
          "name": "Systemic crypto-market contagion",
          "probability": "n/a",
          "severity": "n/a",
          "compensation": "0%"
        }
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": 0.2,
    "target_interest_rate": 0.005,
    "global_minting_limit": null,
    "liquidation_price": 45000,
    "maturity": null,
    "auction_duration": 24,
    "minimum_collateral": 0.1
  }
}
---

# Collateral Risk Assessment: Wrapped Bitcoin

## Summary

WBTC is a high-quality collateral candidate, primarily managed by BitGo, one of the largest BTC custodians in the space.

The main risks are wrapper-specific: residual smart-contract risk and counterparty dependency of BitGo & connected merchants.


## Introduction

WBTC is an ERC-20 representation of Bitcoin on Ethereum. Each WBTC is intended to be backed 1:1 by BTC held in custody, allowing Bitcoin exposure to be used in Ethereum-based DeFi applications.

The WBTC structure relies on a custodian-and-merchant model. BitGo acts as the primary custodian of the underlying BTC reserves, while approved merchants support the minting and burning process. Users who want to mint WBTC transfer BTC through an approved merchant, after which WBTC is minted on Ethereum. Conversely, WBTC can be burned through the merchant process to release the corresponding BTC.

## Free Float/Liquidity

Classification: Strong

WBTC has strong secondary-market liquidity and broad DeFi integration. It is one of the most established ERC-20 BTC wrappers and records very high trading volumes across major centralized and decentralized venues.

## Public Information

Classification: Strong

Public information is strong as there are several highly liquid secondary markets, meaning potential auction outcomes can easily be assessed.

## Market Risk

99%-VaR, 48h close-to-close: 8.11%

Maximum Drawdown, 48h close-to-close: 16.68%

The Maximum Drawdown over 48 hours over the last 2 years of trading data from Yahoo, measured close-to-close, was 16.68%.

This means a retained reserve of 20% is sufficient to cover ordinary BTC market volatility and account for the challenger reward during a liquidation.

## Tail Risks

### Counterparty Risk: BitGo + Merchant network

Description: WBTC depends on its custody and merchant structure for minting, burning, and BTC backing.

Probability: Very Low

Severity: Severe

Compensation: 0.25%

The counterparty risk stems from the wrapper’s custody and operational dependencies. Because WBTC relies on a broader merchant network for minting and redemption, operational risk is marginally higher than for a single-issuer structure such as cbBTC. A 0.25% compensation therefore appears appropriate.

### Smart Contract Risk: Smart-Contract Exploit

Description: WBTC is implemented as an ERC-20 token and therefore carries residual contract-level risk.

Probability: Very Low

Severity: Severe

Compensation: 0.25%

WBTC is a mature and widely used contract, but technical risk cannot be eliminated completely. A 0.25% compensation seems appropriate.

### Governance Risk: Admin-Control

Description: WBTC includes admin-controlled functions and depends on the operational governance of the WBTC custody and merchant structure. However, the contract does not include a specific address-level blacklist or freeze function comparable to cbBTC.

Probability: Negligible

Severity: n/a

Compensation: 0%

The main admin-control dependency is already captured under counterparty risk, because it relates to the same custody, minting, burning, and redemption structure. Since WBTC does not allow targeted address-level freezing, no additional governance-risk compensation is assigned to avoid double-counting.

### Legal Risk: n/a

Description: No separate legal-risk premium is assigned in the current classification.

Probability: n/a

Severity: n/a

Compensation: n/a

Legal and regulatory considerations are partly captured through the broader counterparty and custody dependency of the wrapper. No standalone compensation is assigned here.

### Liquidity Risk: Redemption or secondary-market liquidity impairment

Description: WBTC liquidity depends on secondary-market depth and the continued functioning of redemption paths.

Probability: Negligible

Severity: n/a

Compensation: 0%

WBTC is one of the most widely distributed and most liquid ERC-20 tokens, meaning that liquidity risk is negligible.

### Contagion Risk: Systemic crypto-market contagion

Description: WBTC remains exposed to broad crypto-market stress through the underlying BTC exposure and liquidity conditions.

Probability: n/a

Severity: n/a

Compensation: 0%

Even during severe market stress events like 10/10/2025, the liquidation cascades/flash crashes didn't impair assets like WBTC beyond the assigned market risk. Hence, no separate compensation is needed.

## Conclusion

WBTC is a very strong collateral candidate for Frankencoin.

The proposed retained reserve of 20% is appropriate relative to the observed 48h market-risk metric of 16.81%. The remaining risk premium is mainly driven by wrapper-specific risks, especially smart-contract risk and counterparty dependency of BitGo & connected merchants.
