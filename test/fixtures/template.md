---
{
  "asset_name": "",
  "asset_ticker": "",
  "contract_address": "",
  "assessment_date": "",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "",
    "coingecko": "",
    "website": "",
    "docs": "",
    "other": ""
  },
  "risk_scores": {
    "public_information": "",
    "free_float": "",
    "market_risk": "",
    "tail_risks": {
      "counterparty_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ],
      "smart_contract_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ],
      "governance_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ],
      "legal_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ],
      "liquidity_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ],
      "contagion_risks": [
        {
          "name": "",
          "probability": "",
          "severity": "",
          "compensation": ""
        }
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": null,
    "target_interest_rate": null,
    "global_minting_limit": null,
    "liquidation_price": null,
    "maturity": null,
    "auction_duration": null,
    "minimum_collateral": null
  }
}
---

# Collateral Risk Assessment: [Asset Name]

## Summary

[Asset] is a [short classification] collateral candidate.

The main residual risks are [main risk 1], [main risk 2], and [main risk 3].

## Introduction

[Asset] is [short explanation of the asset].

It is designed to [economic purpose / wrapper function / protocol function]. The relevant collateral exposure is [underlying asset or claim], while the main additional risks come from [issuer / wrapper / protocol / liquidity / legal structure].

## Free Float/Liquidity

Classification: [Strong / Sufficient / Insufficient]

[Short paragraph on trading venues, secondary-market liquidity, DEX/CEX depth, redemption availability, and whether liquidation appears feasible.]

## Public Information

Classification: [Strong / Sufficient / Insufficient]

[Short paragraph on quality of public data, documentation, contract visibility, market data, issuer transparency, dashboards, proof-of-reserves, audits, or reporting.]

## Market Risk

MDD 48h / 99%-VaR 48h: [x]%

[Short paragraph on the relevant market-risk metric and data source.]

This means a retained reserve of [x]% is [sufficient / appropriate / conservative] to cover ordinary market volatility and account for the challenger reward during a liquidation.

## Tail Risks

### Counterparty Risk: [Risk Name]

Description: [Short description of counterparty, issuer, custodian, redemption, or operational dependency.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

### Smart Contract Risk: [Risk Name]

Description: [Short description of contract, wrapper, bridge, vault, or protocol-level technical risk.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

### Governance Risk: [Risk Name]

Description: [Short description of admin controls, DAO governance, parameter changes, freezing rights, upgradeability, or multisig dependency.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

### Legal Risk: [Risk Name]

Description: [Short description of legal enforceability, sanctions, transfer restrictions, redemption eligibility, securities risk, or regulatory dependency.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

### Liquidity Risk: [Risk Name]

Description: [Short description of secondary-market liquidity, redemption risk, liquidation depth, auction feasibility, or market-hours mismatch.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

### Contagion Risk: [Risk Name]

Description: [Short description of protocol contagion, systemic market stress, correlated liquidation risk, or ecosystem dependency.]

Probability: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short rationale.]

## Conclusion

[Asset] is a [strong / credible / acceptable / higher-risk] collateral candidate for Frankencoin.

The proposed retained reserve of [x]% is appropriate relative to the observed market-risk metric of [x]%. The remaining risk premium is mainly driven by [main tail risks]. 
