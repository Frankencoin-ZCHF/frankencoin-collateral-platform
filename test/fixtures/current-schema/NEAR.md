---
{
  "asset_name": "NEAR Protocol",
  "asset_ticker": "NEAR",
  "contract_address": "0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4",
  "assessment_date": "2026-11-09",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "https://etherscan.io/address/0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4",
    "coingecko": "https://www.coingecko.com/en/coins/near",
    "website": "https://near.org/",
    "docs": "https://rainbowbridge.app/",
    "other": "https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/137"
  },
  "risk_scores": {
    "public_information": "Strong",
    "free_float": "Sufficient",
    "market_risk": "30.06%",
    "tail_risks": {
      "counterparty_risks": [
        {
          "name": "NEAR Foundation",
          "probability": "Medium",
          "severity": "Severe",
          "compensation": "1.50%"
        }
      ],
      "smart_contract_risks": [
        {
          "name": "NEAR–Ethereum Bridge",
          "probability": "Very Low",
          "severity": "Critical",
          "compensation": "0.50%"
        },
        {
          "name": "Ethereum NEAR Token",
          "probability": "Very Low",
          "severity": "Critical",
          "compensation": "0.50%"
        }
      ],
      "governance_risks": []
    }
  },
  "risk_parameters": {
    "retained_reserve": 0.35,
    "target_interest_rate": 0.025,
    "global_minting_limit": 4500000,
    "maturity": "2 years",
    "auction_duration": 24
  }
}
---

# Collateral Risk Assessment: NEAR Protocol

## Summary

NEAR is the native asset of the NEAR protocol, a proof-of-stake Layer 1 focused on scalable, low-cost applications and chain abstraction. The collateral considered here is the NEAR token on Ethereum. Its conversion into native NEAR relies on the currently supported Omni Bridge route.

The 35% retained reserve covers the worst observed market drawdown. The 2.5% effective interest rate covers the following tail risks: reliance on the counterparty maintaining the bridge route, bridge smart-contract risk and Ethereum token smart-contract risk.

## Asset Overview

NEAR is used to pay transaction fees, secure the network through validator staking and participate in protocol governance.

At the time of assessment, NEAR was ranked #22 on CoinGecko, with a market capitalisation of approximately USD 4.7 billion and 24-hour trading volume of approximately USD 558 million. 

The Ethereum token is minted after a NEAR-side transfer is finalised on Ethereum and is burned when transferred back to the NEAR blockchain.

## Free Float

Classification: Sufficient

Native NEAR trades actively across multiple independent exchanges. This gives challengers and auction buyers access to deep native NEAR liquidity without relying on one marketplace.

The Ethereum token has materially lower direct on-chain liquidity. If the bridge route is unavailable, liquidators cannot access native NEAR’s deep CEX liquidity and must rely on the much thinner Ethereum-side market. At the intended limit, that could materially impair liquidation proceeds.

## Public Information

Classification: Strong

NEAR has transparent market data, public protocol documentation and observable on-chain activity. This allows challengers to value NEAR and estimate expected auction proceeds.

## Market Risk

Maximum observed drawdown over the last 2 years, 48-hour close-to-close: 30.06%

A 35% retained reserve covers this observed drawdown and provides additional room for the challenger reward and a potential liquidation discount.

## Tail Risks

### Counterparty Risk: NEAR Foundation

Likelihood: Medium

Severity: Severe

Compensation: 1.50%

NEAR on Ethereum depends on the NEAR ecosystem maintaining the Omni Bridge route between Ethereum and the NEAR blockchain.

If the route is discontinued or unavailable to process transfers at the required size, the Ethereum token may not be convertible into native NEAR in time for an efficient liquidation and an auction could result in a substantial discount.

### Smart-Contract Risk: NEAR–Ethereum Bridge

Likelihood: Very Low

Severity: Critical

Compensation: 0.50%

A defect or exploit in the Omni Bridge’s cross-chain message verification or settlement process could lead to unlimited minting on Ethereum, impair conversion, or make the Ethereum token unrecoverable as native NEAR.

### Smart-Contract Risk: Ethereum NEAR Token

Likelihood: Very Low

Severity: Critical

Compensation: 0.50%

The Ethereum NEAR token uses bridge-specific minting and burning functions in addition to standard ERC-20 functionality. A defect in the token contract's proof handling, mint-and-burn accounting or adapter integration could create an incorrect token supply or impair settlement even if native NEAR remains economically intact.

## Conclusion

The 35% retained reserve exceeds the 30.06% maximum observed 48-hour close-to-close drawdown and provides a buffer for challenger reward and liquidation execution.

The 2.50% effective interest rate compensates the counterparty risk, bridge smart-contract risk and token smart-contract risk.

The 4,500,000 ZCHF global minting limit restricts the maximum withdrawable amount to 2,925,000 ZCHF. It relies on the Omni Bridge route remaining available to access native NEAR liquidity. If that route is unavailable, the much thinner Ethereum-side market could materially impair liquidation proceeds. NEAR’s Sufficient Free Float supports a 24 hour auction duration, and a maturity of 2 years is appropriate before reassessment.
