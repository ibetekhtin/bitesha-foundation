# BITESHA — Tokenomics

Companion to [TOKEN_MODEL.md](./TOKEN_MODEL.md) (which covers the *why*, i.e. the
no-profit design). This document covers the *numbers*.

> Allocation percentages below are **design intent**, encoded in
> `contracts/core/BTSHTokenConfig.sol`. They are subject to legal review and may change.

---

## 1. Supply

| Property | Value |
|---|---|
| Name / Ticker | BITESHA / BTSH |
| Total supply | 1,000,000,000 BTSH (fixed) |
| Decimals | 18 |
| Inflation | None — one-time genesis mint, no post-genesis minting |
| Standard | ERC-20 + ERC20Votes + ERC20Permit |
| Network | Base (primary) |

## 2. Genesis distribution

| Bucket | % | BTSH | Vesting / lock |
|---|---|---|---|
| Ecosystem & growth of the mission | 30% | 300,000,000 | 4-year linear |
| Foundation treasury | 20% | 200,000,000 | DAO-controlled |
| Team (compensation) | 15% | 150,000,000 | 1-yr cliff + 3-yr linear |
| Community & DAO governance | 15% | 150,000,000 | governance distribution |
| Charity reserve | 10% | 100,000,000 | DAO-governed reserve |
| Public donation round | 5% | 50,000,000 | available at launch |
| DEX liquidity | 5% | 50,000,000 | locked 1 year |
| **Total** | **100%** | **1,000,000,000** | |

`BTSHTokenConfig` encodes these in basis points; a test asserts the buckets sum to
exactly 10,000 bps (100%). **There is no private-investor allocation** — deliberately
removed to avoid profit-expectation signaling.

## 3. What BTSH is and is not

**Is:** a donation receipt; a governance vote (via ERC20Votes delegation).

**Is not:** a yield instrument (no staking/rewards), a profit-share, a security
marketed for appreciation, or inflationary. See [TOKEN_MODEL.md](./TOKEN_MODEL.md).

## 4. Token utility

1. **Governance** — delegate BTSH to vote on foundation proposals (treasury
   allocations, parameters, partnerships).
2. **Donation receipt** — proof of contribution to the mission.

That is the complete utility set. No utility creates a financial return.

## 5. Value-flow honesty

BTSH does **not** capture revenue, fees, or charity inflows. The charity funds flow in
**USDC** through `CharityVault`, entirely separate from the BTSH token. BTSH's purpose
is coordination and governance, not value accrual. This separation is intentional and
is a core part of the no-profit posture.

## 6. Emissions schedule

There are no emissions. Supply is fixed at genesis. Vesting only releases
**already-minted** tokens over time; it does not create new supply.

## 7. Open items for legal review

- Whether the public donation round + DEX liquidity create a secondary-market price
  expectation that affects securities analysis (see [LEGAL-BRIEF.md](./LEGAL-BRIEF.md) §5).
- Whether team/ecosystem vesting affects the analysis.
- Possible mitigations: non-transferable token, removing/delaying DEX liquidity,
  contribution caps.
