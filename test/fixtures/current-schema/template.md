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
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": null,
    "target_interest_rate": null,
    "global_minting_limit": "no limit",
    "maturity": null,
    "auction_duration": null
  }
}
---

# Collateral Risk Assessment: [Asset Name]

## Summary

[Asset] is a [short classification] collateral candidate.

The main residual risks are [main risk 1], [main risk 2], and [main risk 3].

## Asset Overview

[Asset] is [short explanation of the asset].

It is designed to [economic purpose / wrapper function / protocol function]. The relevant collateral exposure is [underlying asset or claim], while the main additional risks come from [issuer / wrapper / protocol / liquidity / legal structure].

## Free Float

Classification: [Strong / Sufficient / Insufficient]

[Short paragraph on trading venues, secondary-market liquidity, DEX/CEX depth, redemption availability, and whether liquidation appears feasible.]

## Public Information

Classification: [Strong / Sufficient / Insufficient]

[Short paragraph on quality of public data, documentation, contract visibility, market data, issuer transparency, dashboards, proof-of-reserves, audits, or reporting.]

## Market Risk

99%-VaR, 48h close-to-close: [x% / n/a]

Worst historical 48h close-to-close drawdown: [x% / n/a]

[Short paragraph on the relevant market-risk metric and data source.]

This means a retained reserve of [x]% is [sufficient / appropriate / conservative] to cover ordinary market volatility and account for the challenger reward during a liquidation.

## Tail Risks

### Counterparty Risk: [Counterparty]

Likelihood: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short assessment of issuer, custodian, redemption, or other operational dependency.]

### Smart-Contract Risk: Smart-Contract Exploit

Likelihood: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Describe the contract architecture and relevant privileged functions, such as mint, burn, pause, freeze, blacklist, wipe, transfer restrictions, upgrade or role-management functions. State whether these controls are expected for the token type and distinguish technical risk from admin-control risk.]

### Governance Risk: Admin-Control

Likelihood: [Negligible / Very Low / Low / Medium / High / n/a]

Severity: [Moderate / Severe / Critical / n/a]

Compensation: [x% / n/a]

[Short assessment of admin controls, upgradeability, freeze/blacklist/pause rights, dilution, compliance restrictions, or other governance impairment paths.]

## Conclusion

The [x]% retained reserve provides a reasonable buffer against the [x]% worst historical 48h close-to-close drawdown. The [x]% effective interest rate compensates the assessed tail risks. The framework [does / does not] require a cap on the global minting limit based on the tail risk analysis; [asset]'s [liquidity / Free Float] supports a [x]-hour auction duration, and [its established market position / appropriate rationale] makes a maturity of [x] reasonable before the collateral needs to be reassessed.
