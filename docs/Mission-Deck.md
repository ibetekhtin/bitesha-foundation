# BITESHA — Mission & Donor Deck

> **Feeding people on the streets of New York — verifiably.**
> Token: BTSH · Network: EVM L2 (Base) · Supply: 1,000,000,000 fixed · Donation + governance only

> ⚠️ This is a **donation / impact** document, not an investment offer. BTSH is not
> sold or marketed as an investment, carries no profit expectation, and has no yield.
> See [TOKEN_MODEL.md](./TOKEN_MODEL.md).

---

## 1. The Problem

People go hungry on the streets of New York every day. At the same time, charitable
giving suffers from a trust gap:

- **Opacity** — donors rarely see where their money actually goes.
- **Overhead doubts** — "how much really reaches the people?" is hard to answer.
- **Unverifiable reporting** — annual PDFs you have to take on faith.

---

## 2. The Solution

BITESHA is a **charitable ecosystem** that makes giving provable. Every contribution
flows through a smart contract that splits it **80% food / 20% operations** and records
every dollar on a public blockchain.

| Pillar | What it does |
|---|---|
| CharityVault | Immutable 80/20 split, held in USDC |
| TransparencyRegistry | Tamper-evident, signed monthly reports |
| Live dashboard | Real-time raised / spent / meals funded, read from chain |
| BITESHA DAO | Community governs the foundation's decisions |

---

## 3. How It Works

```
You donate (USDC)
   ↓
CharityVault  ──80%──▶  Food fund   ──▶  Meals bought from NYC suppliers
   │                                       (purpose + receipt logged on-chain)
   └────────────20%──▶  Operations  ──▶  Logistics, volunteers, legal
   ↓
You receive BTSH  →  a donation receipt + a vote in how the foundation is run
```

The 80/20 split is fixed in code. Rounding always favours food, so food provably
receives **≥ 80%** — never less.

---

## 4. Token: BTSH

| Property | Value |
|---|---|
| Name / Ticker | BITESHA / BTSH |
| Total Supply | 1,000,000,000 (fixed, no inflation) |
| Network | Base (primary) |
| Standard | ERC-20 + ERC20Votes |

**What BTSH is:**
- A **donation receipt** for contributing to the mission
- A **governance right** — delegate it to vote in BITESHA DAO

**What BTSH is NOT:**
- No staking, no yield, no rewards
- No private-investor tranche, no buybacks, no profit mechanics
- Not marketed for price appreciation or financial return

---

## 5. Token Distribution

| Allocation | % | Notes |
|---|---|---|
| Ecosystem & Growth of the mission | 30% | 4-year linear |
| Foundation Treasury | 20% | DAO-controlled |
| Team (compensation) | 15% | 1-year cliff + 3-year linear |
| Community & DAO governance | 15% | Governance distribution (not yield) |
| Charity Reserve | 10% | Long-term reserve, DAO-governed |
| Public Donation Round | 5% | Available at launch |
| DEX Liquidity | 5% | Locked 1 year |

(Encoded in `BTSHTokenConfig` — sums to 100%. No "private investor" bucket exists.)

---

## 6. Why Blockchain Here

Not for hype — for **accountability**:

- Donors can **verify**, not trust: the 80/20 split can't be quietly changed.
- Every food purchase has an on-chain `purpose` + `receiptHash`.
- Monthly reports are cryptographically signed and anchored on-chain; anyone can
  verify them with `scripts/verify-report.js` — no insider access needed.

---

## 7. What We're Honest About

The contract guarantees the **split and the transparency**. It cannot, by itself,
guarantee that the 80% is physically spent on food — that final step happens in the
real world and is secured by **published receipts, photos, video, and multisig
control with independent representatives**, not by code. We say this plainly because a
charity that overstates what its tech does is not trustworthy.

---

## 8. Roadmap

- [ ] Smart-contract audit (independent) + financial-model audit
- [ ] Legal: NY AG charitable registration, 501(c)(3), securities opinion on BTSH
- [ ] Testnet deployment + public dashboard live
- [ ] First food distributions in NYC, first signed monthly report anchored
- [ ] DAO activation — community governs the foundation

---

## 9. Team & Principles

- AI-augmented founding team (Claude CTO + human oversight)
- Every decision passes the [RFC-0001 decision framework](./RFC-0001-Decision-Framework.md),
  whose Filter 0 is **Integrity** — "could we explain this to a regulator in 10 years?"
- Transparency and legal correctness are treated as features, not afterthoughts.

---

## 10. The Vision

```
Donors who can verify
   ↓
Provable, low-doubt giving
   ↓
More food reaching more people
   ↓
A charity model others can copy
```

> We are not building a token to get rich.
> We are building a way to feed people that anyone can audit.
