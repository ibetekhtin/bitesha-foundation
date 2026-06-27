# BITESHA — Transparency System

This document describes how BITESHA proves, end to end, where every dollar goes —
turning the charity from "trust us" into "verify us."

## The four pillars

| Pillar | Implementation | Status |
|--------|----------------|--------|
| Real-time public dashboard | [`dashboard/index.html`](../dashboard/index.html) | ✅ built |
| Monthly cryptographically signed reports | [`scripts/generate-report.js`](../scripts/generate-report.js) + [`TransparencyRegistry`](../contracts/charity/TransparencyRegistry.sol) | ✅ built |
| On-chain impact metrics ("people helped") | `CharityVault.totalMealsFunded` | ✅ built |
| Independent audit (contracts **and** financial model) | external engagement | ⏳ required |
| Multisig incl. independent representatives | role holders = Gnosis Safe | ⏳ deploy-time |

---

## 1. Live dashboard

`dashboard/index.html` is a single static file (no backend) that reads **directly from
the blockchain** via any RPC endpoint. Nothing on it is self-reported:

- Total raised (USDC, all-time)
- Allocated to food / operations + currently available in each fund
- **Meals funded** (from the on-chain `totalMealsFunded` counter)
- Effective food share (provably ≥ 80%)
- The most recent on-chain food-spending transactions, with purpose + receipt hash

Host it on IPFS / GitHub Pages. Because it only reads public chain data, it can never
show numbers that differ from the contract.

## 2. Monthly signed reports

Each month the foundation produces a report bundle and anchors it on-chain so it
becomes tamper-evident and timestamped.

**Generate (foundation):**
```bash
VAULT=0x... PERIOD=202607 REPORTING_KEY=0x<privkey> \
  npx hardhat run scripts/generate-report.js --network base
```
This pulls every `Deposited` / `FoodSpent` / `OpsSpent` event in the month, builds a
**canonical** JSON (sorted keys, no whitespace → reproducible hash), signs the hash with
the foundation reporting key, and writes `reports/report-<period>.json` + `.sig`.

**Anchor (multisig with independent reps):**
```solidity
registry.anchorReport(202607, reportHash, ipfsCid, signature)
```
One report per period, immutable once anchored.

**Verify (anyone, no secrets needed):**
```bash
REPORT=reports/report-202607.json SIG=reports/report-202607.sig \
EXPECTED_SIGNER=0x... REGISTRY=0x... PERIOD=202607 \
  npx hardhat run scripts/verify-report.js --network base
```
This recomputes the hash, recovers the signer, and checks it against the on-chain
anchor. A single altered byte in the report breaks the hash → verification fails.

The report bundle on IPFS holds the human evidence: receipts, photos, videos. The
on-chain anchor proves the bundle you downloaded is exactly the one published.

## 3. On-chain impact metrics

`CharityVault.spendFood(to, amount, mealsFunded, purpose, receiptHash)` records the
number of meals each purchase funds. `totalMealsFunded` accumulates this on-chain, so
"people helped" on the dashboard is backed by chain data, not a marketing number.

## 4. What stays off-chain (and why that's honest)

- The contract **cannot** force the food operator to actually buy food — that purchase
  happens in the real world. Accountability for it comes from the published
  `purpose` + `receiptHash` of every spend, reconcilable against the monthly bundle.
- The signed report proves **integrity** (the artifact wasn't altered), not
  **truthfulness** of the underlying photos/receipts. Truthfulness comes from
  independent audit + public reconciliation.

---

## Governance of trust

- **Spender roles** (`FOOD_SPENDER_ROLE`, `OPS_SPENDER_ROLE`) and the registry
  **`PUBLISHER_ROLE`** must be held by **multisig wallets (Gnosis Safe)** whose
  signers include **independent representatives** — so no single person can move funds
  or publish a report alone.
- The **80/20 split is immutable** and not governable, by design.

---

## ⚠️ Legal note — token + charity + profit expectation

This is the single most important non-engineering risk and must be designed with
counsel **before** any public sale or marketing:

If BTSH is **(a)** sold as a token, **(b)** used to fund charity, **and (c)** marketed in
a way that creates an **expectation of price appreciation or profit**, then under the
US **Howey test** it may be treated as a **security** — regardless of the charitable
purpose. Charitable intent does not by itself create an exemption.

Practical implications to design around from day one:
- Keep marketing focused on the **donation / impact** narrative, not "investment" or
  "returns."
- Separate the **donation flow** (into `CharityVault`) from any **speculative token
  trading** narrative.
- Get a **securities-law opinion** on BTSH's structure and messaging.
- Pair it with the charity-registration / tax items in [CHARITY.md](./CHARITY.md).

> The technical system here makes the money flow provably transparent. It does not, and
> cannot, substitute for legal structuring. Build both in parallel.
