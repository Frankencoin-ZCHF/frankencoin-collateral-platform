---
{
  "asset_name": "Boss Info AG",
  "asset_ticker": "BOSS",
  "contract_address": "0x2e880962a9609aa3eab4def919fe9e917e99073b",
  "assessment_date": "2026-11-05",
  "author": "Paolo Di Stefano",
  "links": {
    "etherscan": "https://etherscan.io/token/0x2e880962a9609aa3eab4def919fe9e917e99073b",
    "coingecko": "",
    "website": "https://shares.bossinfo.com",
    "docs": "https://docs.aktionariat.com/en",
    "other": "https://reporting.bossinfo.com/en/2025/annual-financial-statements"
  },
  "risk_scores": {
    "public_information": "Sufficient",
    "free_float": "Sufficient",
    "market_risk": "n/a",
    "tail_risks": {
      "counterparty_risks": [
        {"name": "Boss Info AG", "probability": "Medium", "severity": "Critical", "compensation": "3.00%"}
      ],
      "smart_contract_risks": [
        {"name": "Smart-Contract Exploit", "probability": "Very Low", "severity": "Critical", "compensation": "0.50%"}
      ],
      "governance_risks": [
        {"name": "Admin-Control", "probability": "Very Low", "severity": "Critical", "compensation": "0.50%"}
      ]
    }
  },
  "risk_parameters": {
    "retained_reserve": 0.40,
    "target_interest_rate": 0.04,
    "global_minting_limit": 5000000,
    "maturity": "2 years",
    "auction_duration": 72
  }
}
---

# Collateral Risk Assessment: Boss Info AG shares

## Summary

BOSS is the tokenized equity of Boss Info AG, a private Swiss IT services, ERP implementation and software-integration business. It represents private-company equity rather than a liquid crypto asset or listed security.

There is no continuously observable secondary-market price for BOSS. Collateral value must therefore be assessed from the company's financial performance and a fundamental equity valuation, while liquidation depends on a narrower buyer universe than for listed shares.

The main residual risks are Boss Info AG's operating and financial performance, the token's processor- and rule-engine-dependent contract stack, and privileged controls that can alter token logic, transfer validation or token supply.

## Asset Overview

The 2025 financial statements show a meaningful recovery in operating performance, with CHF 38.5 million of operating revenue, CHF 6.3 million of EBITDA, CHF 0.9 million of EBIT and CHF 5.7 million of operating cash flow. The company remains more balance-sheet constrained than a pure software business, with low book equity, substantial intangibles and approximately CHF 8.5 million of net financial debt.

The valuation considers four methods:

- Adjusted net asset value: CHF 0.4 million–6.4 million. This has limited relevance for an IT services and software-integration business because customer relationships, implementation know-how and internally generated business value are not fully captured on the balance sheet.
- Earnings value: CHF 19.8 million–44.5 million. This is highly relevant because it reflects the sustainable profit base, using the stronger operating years 2025, 2023 and 2022 rather than treating 2024 as representative.
- Comparable-company multiples: CHF 29.5 million–53.7 million. This is highly relevant because it reflects observed valuations for comparable IT services and software-integration businesses. Applying approximately 8.5×–8.8× to 2025 EBITDA and deducting net financial debt supports around CHF 45 million–47 million of equity value, or CHF 4.25–4.45 per share.
- Discounted cash flow: CHF 16.1 million–53.0 million. This captures operating recovery and cash generation but remains sensitive to growth, margins, reinvestment, WACC and terminal assumptions.

For the nature of the business, the earnings-value and multiples approaches are the most relevant. They support an equity reference value of approximately CHF 47 million, or around CHF 4.40 per share.

## Free Float

Classification: Sufficient

BOSS has a tokenized shareholder base and a small, identified-user marketplace operated through shares.bossinfo.com.

However, BOSS remains private-company equity. Auction outcomes depend on buyers' willingness to acquire Boss Info AG shares at a fundamental valuation rather than on a deep, continuously quoted market. This supports a Sufficient, rather than Strong, Free Float classification.

## Public Information

Classification: Sufficient

Boss Info AG's financial statements, company information and on-chain token contracts provide a basis for challengers to estimate the equity value and expected auction outcomes.

Public information remains weaker than for a listed company. There is no continuously observable secondary-market price, and company value must be estimated from financial statements, comparable-company evidence and the capital structure.

## Market Risk

99%-VaR, 48h close-to-close: n/a

Worst 48h close-to-close drawdown observed over the assessment window: n/a

BOSS has no reliable continuous secondary-market price series. The retained reserve is therefore calibrated to valuation uncertainty and the expected discount required to sell private-company equity through an auction.

## Tail Risks

### Counterparty Risk: Boss Info AG

Likelihood: Medium

Severity: Critical

Compensation: 3.00%

BOSS represents equity in a private operating company. The 2025 operating recovery and positive cash flow support the valuation, but low book equity, substantial intangibles and material net financial debt remain relevant. A deterioration in operating performance, financial position or execution could materially impair the value of the equity.

### Smart-Contract Risk: Smart-Contract Exploit

Likelihood: Very Low

Severity: Critical

Compensation: 0.50%

BOSS is an upgradeable ShareBridgeToken rather than a standalone ERC-20. It routes balances, transfer validation, minting, burning and seizure through an external Processor, which in turn uses a Rule Engine. A technical failure in the token, Processor or Rule Engine could independently impair balances, transferability or recoverability.

### Governance Risk: Admin-Control

Likelihood: Very Low

Severity: Critical

Compensation: 0.50%

The BOSS proxy administrator can upgrade the token implementation. The token owner can add administrators, change transfer rules, replace the Processor and add or remove suppliers and seizers. The current owner is an active supplier and can mint tokens to any address or burn tokens from any address without the holder's allowance. No active seizer is currently configured, but the owner can add one. These controls could alter transfer validation, token supply or the ability to liquidate BOSS collateral.

## Conclusion

The 40% retained reserve provides a substantial buffer against valuation uncertainty and the auction discount required for private-company equity. The 4.00% effective interest rate compensates the assessed tail risks. The framework requires a cap on the global minting limit because Boss Info AG carries a Medium-probability counterparty risk; the 5,000,000 ZCHF global minting limit restricts the maximum withdrawable amount to 3,000,000 ZCHF. BOSS's Sufficient Free Float supports a 72-hour auction duration, and a maturity of 2 years is reasonable before the collateral needs to be reassessed.
