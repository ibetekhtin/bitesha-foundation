# BITESHA — Charity Model

## Mission

Feed people on the streets of New York. BITESHA is a charitable ecosystem: when
people buy the BTSH token, the proceeds fund food distribution to those in need.

## The 80/20 policy

Every dollar that flows into the [`CharityVault`](../contracts/charity/CharityVault.sol)
is split automatically and immutably:

| Share | Destination | Purpose |
|-------|-------------|---------|
| **80%** | Food fund | Buying food for street distribution in NYC |
| **20%** | Operations fund | Logistics, volunteers, legal, organizing |

The split is held in **USDC** (a stablecoin), so $80 earmarked for food stays
worth $80 until the food is actually purchased — no exposure to crypto volatility.

## What the smart contract guarantees (on-chain, verifiable by anyone)

1. **The 80/20 split is fixed in code.** `FOOD_BPS = 8000`, `OPS_BPS = 2000` are
   `constant`. No admin, no DAO, no key can change them. This is deliberate — a
   charity promise that can be quietly edited is not a promise.
2. **Every dollar is accounted.** `totalReceived`, `totalToFood`, `totalToOps`,
   `totalSpentFood`, `totalSpentOps` are public and only ever increase.
3. **Rounding always favours food.** The operations share is floored and the
   remainder (any dust) goes to food, so food always receives **≥ 80%**, never less.
   (`effectiveFoodShareBps()` is provably ≥ 8000.)
4. **Every withdrawal is public.** `spendFood` / `spendOps` emit an event with the
   recipient, amount, a human-readable `purpose`, and a `receiptHash` linking to an
   off-chain invoice/receipt.

## What the smart contract CANNOT guarantee (and we will not pretend otherwise)

The contract routes 80% of funds to the food operator's wallet. It **cannot**
force that operator to actually buy food from a real NYC supplier — that purchase
happens off-chain, in the physical world, in US dollars.

That final step is secured not by code but by **accountability**:

- Each `spendFood` call must publish a `purpose` (e.g. *"500 meals — Bronx, 2026-07-01"*)
  and a `receiptHash` pointing to the actual invoice.
- All receipts are published so anyone can reconcile on-chain spending against
  real-world food delivered.
- Spender roles are intended to be held by **multisig wallets (Gnosis Safe)**, not a
  single person — no individual can move charity funds alone.

This honesty is the point. Crypto cannot magically enforce real-world charity; it
can make the money flow **transparent and tamper-evident**, which is exactly what a
donor deserves.

## Operational design notes

- **Why roles, not a timelock, for spending?** Feeding people must be fast — you
  cannot wait 2 days to buy food. Spend functions are gated by `FOOD_SPENDER_ROLE` /
  `OPS_SPENDER_ROLE`, meant for org-controlled multisigs. The *split* is what is
  locked immutably; operational spending stays nimble.
- **Why USDC, not ETH or BTSH?** Food is bought in dollars. Holding the charity
  budget in a stablecoin removes the risk that a market dip shrinks the food budget
  between donation and purchase.
- **`sync()`** lets the vault absorb USDC sent directly to its address (raw
  donations) and split it 80/20 just like a normal deposit.

## ⚠️ Compliance — must be resolved before accepting any public funds

A US-based charity raising money via a token sale touches several regulated areas.
These are **legal/operational** prerequisites, not code, and are out of scope for the
contracts — but they are mandatory:

- [ ] **Charitable solicitation registration** with the NY State Attorney General's
      Charities Bureau (required to solicit donations in New York).
- [ ] **Entity + tax status** — e.g. 501(c)(3) determination if tax-deductible
      donations are offered.
- [ ] **Securities review** — if buyers are led to expect profit/return, BTSH may be
      deemed a security (Howey test). Charitable framing does not automatically exempt it.
- [ ] **Money transmission / MSB** analysis for handling crypto-to-fiat conversion.
- [ ] **Food safety** — NYC permits/health regulations for distributing food on the street.

> Engineering can prove where the money goes. It cannot make the program legal.
> Get counsel before launch.
