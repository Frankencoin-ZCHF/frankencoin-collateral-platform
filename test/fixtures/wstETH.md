---
{
  "asset_name": "Wrapped Staked ETH",
  "asset_ticker": "wstETH",
  "contract_address": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  "assessment_date": "2026-08-01",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "https://etherscan.io/token/0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    "coingecko": "https://www.coingecko.com/en/coins/wrapped-steth",
    "website": "https://lido.fi/",
    "docs": "https://docs.lido.fi/contracts/wsteth/",
    "other": "https://stake.lido.fi/wrap"
  },
  "risk_scores": {
    "public_information": "Strong",
    "free_float": "Strong",
    "market_risk": "16.98%",
    "tail_risks": {
      "counterparty_risks": [
        {
          "name": "Lido staking protocol & node-operator set",
          "probability": "Very Low",
          "severity": "Severe",
          "compensation": "0.25%"
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
          "name": "n/a",
          "probability": "n/a",
          "severity": "n/a",
          "compensation": "0%"
        }
      ],
      "legal_risks": [
        {
          "name": "n/a",
          "probability": "n/a",
          "severity": "n/a",
          "compensation": "0%"
        }
      ],
      "liquidity_risks": [
        {
          "name": "Redemption risk",
          "probability": "Low",
          "severity": "Severe",
          "compensation": "0.25%"
        }
      ],
      "contagion_risks": [
        {
          "name": "n/a",
          "probability": "Negligible",
          "severity": "n/a",
          "compensation": "0%"
        }
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": 0.25,
    "target_interest_rate": 0.0075,
    "global_minting_limit": null,
    "liquidation_price": 1300,
    "maturity": null,
    "auction_duration": 24,
    "minimum_collateral": null
  }
}
---

# Collateral Risk Assessment: Wrapped Staked ETH

## Summary

wstETH is the wrapped, non-rebasing version of Lido staked ETH. It represents a claim on stETH, which in turn represents ETH staked through the Lido protocol plus accrued staking rewards.

wstETH is a credible collateral candidate because the underlying exposure is ETH, public information is strong, and wstETH is the deepest and most widely integrated liquid staking token in DeFi. The main residual risks are staking-protocol risk, node-operator/slashing risk, smart-contract risk, and stToken price or redemption-basis risk. Liquidity risk is materially lower than for smaller LSTs, but not zero.

## Introduction

Wrapped Staked ETH (wstETH) is an ERC-20 wrapper of stETH. Unlike stETH, wstETH does not rebase. Instead, the value of one wstETH increases relative to stETH as staking rewards accrue.

Lido is the largest Ethereum liquid staking protocol and wstETH is widely used across major DeFi venues as ETH-denominated collateral. For Frankencoin, the relevant collateral exposure is therefore staked ETH through the Lido staking and wrapper stack, not native ETH itself.

## Free Float/Liquidity

Classification: Strong

wstETH has strong circulating supply, broad DeFi integration, and very deep secondary-market liquidity. It is widely accepted as collateral across lending markets and is actively traded against ETH and other major assets.

## Public Information

Classification: Strong

Public information is strong. Liquidators should be able to value the asset using ETH, stETH, and wstETH market data. Exit capacity is supported by secondary-market depth and the Ethereum withdrawal path through stETH.

## Market Risk

99%-VaR, 48h close-to-close: 13.68%

Maximum Drawdown, 48h close-to-close: 16.98%

The maximum 48h close-to-close drawdown in the dataset is 16.98%. The current retained reserve is 25%, which gives a material buffer above the observed 48h market-risk measure.

A reserve of 20% would still remain above the observed maximum 48h close-to-close drawdown and account for the challenger reward. The additional 5% is not necessarily needed, but provides a useful buffer for possible redemption delays in the withdrawal queue or a temporary discount of wstETH in secondary markets.

### Counterparty Risk: Lido staking protocol & node-operator set

Description: wstETH depends on Lido’s staking infrastructure, node-operator set, validator performance, and protocol operations.

Probability: Very Low

Severity: Severe

Compensation: 0.25%

The underlying exposure is ETH, but wstETH is not native ETH. It depends on the correct functioning of the Lido staking protocol and its node operators. Severe operator failure, or a material slashing event could impair stETH and therefore wstETH relative to ETH.

A 0.25% compensation is assigned for this residual dependency.

### Smart Contract Risk: Smart-Contract Exploit

Description: wstETH relies on the Lido staking contracts, stETH accounting, the wstETH wrapper, and the withdrawal path.

Probability: Very Low

Severity: Severe

Compensation: 0.25%

wstETH is a mature and widely used contract, but it remains part of a larger liquid staking system. A contract-level issue could impair minting, wrapping, unwrapping, or exchange-rate accounting. A 0.25% compensation appears appropriate.

### Governance Risk: n/a

Description: No separate governance-risk premium is assigned in the current classification.

Probability: n/a

Severity: n/a

Compensation: 0%

Lido governance and protocol parameter decisions remain relevant to the overall risk profile, but no standalone governance-risk premium is assigned. The residual governance dimension is treated as part of the broader staking-protocol and smart-contract risk rather than as a separate premium.

### Legal Risk: n/a

Description: No separate legal-risk premium is assigned in the current classification.

Probability: n/a

Severity: n/a

Compensation: 0%

No additional standalone legal-risk premium is assigned. Legal and operational considerations are captured through the broader staking-protocol dependency and the global minting limit.

### Liquidity Risk: Redemption risk

Description: wstETH may trade below its inherent ETH value if withdrawals are delayed, exit queues are long, or secondary-market arbitrage is impaired.

Probability: Low

Severity: Severe

Compensation: 0.25%

wstETH is the deepest and most liquid LST, but it is still not native ETH. In stressed markets, wstETH can trade below its inherent ETH value if the redemption path is delayed or if arbitrage capital is constrained. This basis risk is materially lower than for smaller LSTs because wstETH has deep secondary liquidity and broad DeFi integration, but it is not zero. A 0.25% compensation is therefore appropriate.

### Contagion Risk: n/a

Description: No separate contagion-risk premium is assigned.

Probability: Negligible

Severity: n/a

Compensation: 0%

wstETH remains exposed to broad ETH and liquid-staking market stress, but this is already reflected in the market-risk reserve and the LST-specific tail-risk categories.

## Conclusion

wstETH is a credible collateral candidate for Frankencoin.

The underlying exposure is ETH, and the observed 48h market-risk drawdown of wstETH is 16.98%. The residual premium is driven mainly by LST-specific risks: staking-protocol dependency, node-operator/slashing risk, smart-contract/accounting risk, and redemption-basis risk.
