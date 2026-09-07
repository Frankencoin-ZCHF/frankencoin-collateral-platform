# Collateral Risk Framework

**Version:** 3.0 Final Draft  
**Date:** August 2026  
**Author:** Paolo Di Stefano, Frankencoin Association  

## Purpose

This framework sets out the guiding principles for collateral risk management. It is intended to make governance decisions around collateral proposals more transparent, and risk parameters across collateral assets more consistent.


## 1. Introduction

Frankencoin is a decentralised financial system. The purpose of financial systems is not to eliminate risk altogether, but to manage and transform it. Collateral risk assessments should therefore make the risks of each new collateral proposal explicit, assess potential losses under relevant stress scenarios, and help define parameters that protect the system while also ensuring appropriate compensation for the equity capital at stake.


## 2. System Design

The system becomes undercollateralized when collateral value does not suffice to cover outstanding debt. To protect from this scenario, the Frankencoin system has three lines of defence:

  **1. The overcollateralization of each position:** Each position is protected by its own collateral buffer, determined by the retained reserve.

  **2. The system’s equity capital:** The equity contributions by FPS holders absorb additional losses when the positions’ individual collateral buffers do not suffice.

  **3. The minter reserve:** Finally, reserve contributions from other debt positions can be used as a measure of last resort, socialising residual losses across other minters.



## 3. Liquidation Mechanism

Liquidations protect the system from undercollateralization. They are triggered by challenges and settled through auctions. For this to work, the system relies on participants willing to challenge positions, as well as on bidders willing to buy collateral in an auction.

Challenges are incentivised by the challenger reward, but can only be started by putting up a stake of the same collateral. Potential challengers also require a certain level of confidence for the challenge to succeed to justify the opportunity cost of locking up capital.

Auction bidders are motivated either by arbitrage, where the collateral can be sold for a profit right away, or by the collateral’s fundamental value. The latter could for example be because it represents ownership in a valuable asset off-chain, or because it can be redeemed for a monetary value.

Besides the technical criteria listed [here](https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/11), the following two conditions must be met for the liquidation mechanism to work as intended:

- Free float: The collateral needs to be sufficiently distributed or easy to obtain such that enough independent owners can be incentivised to start a challenge.

- Public information: Challengers need to be able to evaluate expected auction outcomes. This can be based on observable market transactions or, for illiquid assets, on other public information allowing them to estimate the collateral’s market price.

If there is a liquid marketplace for the collateral, both conditions are typically met. This would also allow arbitrage bidders to step in, which should lead to the most efficient auction outcomes.

The existence of a liquid marketplace is however not a strict requirement. Illiquid assets with sufficient free float and public information available can still be strong collateral candidates, but should be treated differently based on the following classifications:

#### Free Float

- Strong: Multiple independent venues exist to trade the collateral, or there are multiple ways to mint and redeem it. This is the preferred case, as no single party can significantly impair the collateral’s free float.

- Sufficient: Liquidity is concentrated on one marketplace, or there is only one controlled mint and redeem mechanism. This is sufficient, but introduces a dependency on a single party who could potentially impair the collateral’s free float. This should be reflected in the tail risk analysis.

- Insufficient: Ownership is concentrated, there is no liquid marketplace, and there is no reliable mechanism for minting and redemption. In this case, it should not be accepted as collateral.

#### Public Information

- Strong: There is a liquid market with regular trading activity, allowing potential challengers to reliably estimate the proceeds an auction could achieve.

- Sufficient: There is little or no observable trading activity, but public information allows potential challengers to estimate an expected auction outcome. This is sufficient, but should be accounted for through a more conservative reserve ratio and liquidation price.

- Insufficient: There is no reliable way for potential challengers to estimate a potential auction outcome. The token should therefore not be accepted as collateral.

Both free float and public information should at least be classified as sufficient for the liquidation mechanism to work as intended. If a condition is classified as insufficient, the collateral should not be accepted.


## 4. Loss scenarios

Even if the liquidation mechanism works as intended, a liquidation can still result in a loss if the auction proceeds do not cover the outstanding debt and challenger reward. Declines below the liquidation price can typically be attributed to two different risk types:

- Market risk: Price movements that can reasonably be expected under stressed but functioning market conditions.

- Tail risk: Extraordinary, high-impact events such as hacks, de-pegs, technical failure, or a sudden collapse in market confidence.


### 4.1 Market Risk

Market risk shall be assessed through the collateral’s price history, if available. Frankencoin’s original research uses historical BTC/CHF returns to assess at which levels liquidations become break-even on average, and calculates the capital reserves required to ensure the system’s survival, using a 99% value-at-risk (VaR) estimate.

This framework takes a more conservative approach than aiming for liquidations to be break-even on average. Liquidations caused by ordinary market risk should in general be fully absorbable by the system’s first line of defence: the overcollateralization of each position, which is determined by the retained reserve. 

This means that liquidations caused by ordinary market risk should typically clear at a profit for the system (= penalty for liquidated borrowers). This incentivises borrowers to monitor collateral health more diligently, with the aim to reduce both the number of liquidations as well as volatility in the equity pool.
Where a reliable price history is available, and returns are close to being normally distributed, market risk should be assessed using a 99% VaR estimate over twice the auction duration. An additional 2% buffer to account for the challenger reward shall then be added to establish the minimum retained reserve requirement, representing the percentage of minted ZCHF allocated to the minter reserve:

<p align="center">
  <strong>Retained Reserve = VaR<sub>99%</sub>(2 × Auction Duration) + 2%</strong>
</p>

For assets without normally distributed returns, the maximum drawdown over the same horizon should be used instead, again adding the 2% buffer for the challenger reward:

<p align="center">
  <strong>Retained Reserve = MDD(2 × Auction Duration) + 2%</strong>
</p>

When no reliable price history is available, market risk should be assessed on a case-by-case basis using comparable assets or other appropriate methodologies. As the number of collateral assessments for such assets grows, this framework should be expanded to capture practical insights and improve consistency among asset classes.

### 4.2 Tail Risk

Tail risks can cause price declines beyond ordinary market movements and would therefore exceed what the first line of defence can absorb. Where such risks exist, the equity pool is at risk. FPS holders should therefore be compensated through an appropriate risk premium, while exposure to tail risks above a certain probability threshold should be limited to ensure that potential losses remain fully absorbable by the second line of defence.

Examples of tail risks include:

- Counterparty risk: The collateral depends on the solvency, integrity or operational reliability of an issuer, sponsor, or custodian. In such a case, sudden price declines could for example arise from fraud or insolvency.

- Smart-contract risk: The collateral, its wrapper or its redemption mechanism depends on smart contracts, bridges, or other blockchain infrastructure that may contain bugs, design flaws, or upgrade risks.

- Governance risk: The collateral can be frozen, blacklisted, diluted, or otherwise affected by a governance body or someone with admin-control.

- Legal risk: The collateral may be technically transferable on-chain but subject to legal restrictions that limit who can hold, redeem or enforce rights attached to the token.

- Liquidity risk: Liquidity is concentrated in a single marketplace, or the asset relies on a single controlled mint-and-redeem mechanism, meaning its free float could be significantly impaired if that single access point fails.

- Contagion risk: The collateral may be exposed to tail-risk events originating elsewhere in the crypto ecosystem, for example through liquidation cascades or the failure of a related protocol or oracle, even if the collateral itself is not directly impaired.

Tail risks usually cannot be assessed using the collateral’s own price history, but require a thorough understanding of the asset’s characteristics and dependencies. Once identified, it should be assessed whether:

  i) the tail risk is acceptable,

  ii) if it already affects existing collateral,

  iii) to what extent (additional) exposure is justified, and 

  iv) what risk premium would appropriately compensate FPS holders.

To achieve this, both the probability and potential severity of each identified tail risk should be estimated. Probabilities should be classified using one of the following categories, and be interpreted as approximate annual probabilities for the tail risk to occur.

- Negligible (<0.5%): The risk only exists in theory and does not need to be explicitly priced.

- Very Low (0.5%): The risk is identifiable but highly unlikely to materialize, for example where the collateral depends on well-established counterparties or infrastructure with a strong track record.

- Low (1.0%): The risk is identifiable but unlikely to materialize, reflecting slightly higher operational complexity or a solid but more limited track record.

- Medium (2.0-5.0%): The risk is material and requires meaningful compensation. This classification is appropriate where significant external dependencies exist, underlying infrastructure is relatively novel, or comparable failures have occurred in the past.

- High (>5.0%): The risk is severe, opaque or structurally difficult to assess. Such risks should generally not be accepted.

The Medium category deliberately encompasses a range of probabilities. This provides flexibility to calibrate the applicable risk premium within that range, reflecting the collateral’s characteristics as well as the system’s risk appetite.

Next, the potential severity of each tail risk should be assessed. Severity corresponds to the expected loss beyond the position’s overcollateralization if a tail risk event occurs. Severity should be classified using one of the following categories:

- Moderate (25%): This may apply where asset quality deteriorates beyond what is expected under normal market conditions, but the collateral retains most of its fundamental value, and remains both enforceable and transferable.

- Severe (50%): A material impairment of the remaining collateral value is expected. This may apply where liquidation remains possible, but market depth or asset quality have deteriorated materially.

- Critical (100%): No reliable residual recovery should be assumed. This may apply in cases of unlimited minting bugs, hacks, or fraud.

#### Compensation

The required compensation for FPS holders can then be calculated by multiplying each tail risk’s probability with its expected severity. This will inform the risk premium required to reach the appropriate effective interest rate.

Let C<sub>i</sub> denote the required compensation for tail-risk event i. Let P<sub>i</sub> ∈ [0.5%, 5%] denote the estimated annual probability of that event, and let S<sub>i</sub> ∈ {25%, 50%, 100%} denote its severity category: moderate, severe, or critical. The required compensation for event i is then C<sub>i</sub> = P<sub>i</sub> × S<sub>i</sub>. Summing this across all identified tail risks, the effective annual interest rate should be given as follows:

<p align="center">
  <strong>Effective Interest = Σ<sub>i</sub> C<sub>i</sub> = Σ<sub>i</sub> (P<sub>i</sub> × S<sub>i</sub>)</strong>
</p>
  
#### Global Minting Limit

Besides determining the interest rate, tail risks should also inform the global minting limit to ensure that any single plausible tail-risk event does not threaten the system’s survival. This means that for each identified tail risk with at least a medium probability assigned, the withdrawable amount, corresponding to the global minting limit without the retained reserve, should remain significantly below the equity capital at stake.

When the same tail risk already affects another active collateral, for example because the counterparty is the same, this equation should hold true for their combined global minting limit.

## 5. Parameter Calibration

The most important parameters for new collateral proposals are the retained reserve, global minting limit, and effective interest rate, which have been established in the previous two sections. The retained reserve and the global minting limit can be entered as established, while the effective interest rate depends both on the system’s base rate as well as the collateral’s specific risk premium.
 
This means that the risk premium to be specified in the collateral proposal is calculated as follows:

<p align="center">
  <strong>Risk Premium = (1- Retained Reserve) × Effective Interest Rate - Base Rate</strong>
</p>

Each proposal further has to define the liquidation price, maturity, auction duration, and minimum collateral amount. These should be defined as follows:

- Liquidation price: It should be set below the current market price, at a level where minters can reasonably assume that their positions are not at risk of liquidation. When the current market price is not observable, an additional buffer should be applied.

- Maturity: Shorter maturities are appropriate for more complex and less battle-tested collateral types, as this would allow for more frequent reassessment, and vice versa. 

- Auction duration: More liquid assets typically benefit from shorter auction durations, while longer auction durations are a better fit for less liquid assets to attract more bidders.

- Minimum Collateral: The minimum collateral amount should exceed a minimum of 5,000 ZCHF in liquidation value, with 7,500 ZCHF or more being preferable.

In general, riskier or less proven collateral should be introduced with more conservative parameters and shorter maturities. Risk parameters should always be calibrated in relation to each other, and in relation to the existing collateral base.

## 6. Conclusion

Collateral risk management should follow a consistent logic across collateral assets. The aim is not to eliminate risk entirely, but to ensure that risks are well-understood, priced appropriately, and limited to levels the system can absorb.

Sufficient free float enables timely challenges, and the availability of public information allows challengers to assess expected auction outcomes. Both are essential collateral requirements. 

Liquidations may arise from ordinary market risk or from tail risk scenarios. Price declines from ordinary market risk should typically be absorbable by the first line of defence, while losses from tail-risk scenarios above a certain probability threshold should be absorbable by the second line of defence to ensure the system’s survival, and FPS holders should be compensated for the capital at stake.
