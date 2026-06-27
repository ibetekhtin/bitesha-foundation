# BITESHA — Smart Contract Architecture

Technical map of the on-chain system. Pairs with
[Security-Architecture.md](./Security-Architecture.md) and
[AUDIT-SCOPE.md](./AUDIT-SCOPE.md).

- **Compiler:** solc 0.8.28, optimizer 200 runs, `viaIR`, `evmVersion: cancun`
- **Libraries:** OpenZeppelin Contracts v5.x
- **Network:** Base (primary), EVM L2 generally
- **Total production SLOC:** ~889 across 11 contracts

---

## 1. Contract inventory

| Contract | Inherits | Purpose |
|---|---|---|
| `core/BTSH` | ERC20, ERC20Permit, ERC20Votes, Ownable, Pausable | Fixed-supply donation+governance token |
| `core/BTSHTokenConfig` | (library) | Distribution constants (bps) |
| `charity/CharityVault` | AccessControl, ReentrancyGuard | USDC custody; immutable 80/20 split; gated spend |
| `charity/TransparencyRegistry` | AccessControl | Anchors signed monthly report hashes |
| `treasury/BITESHATreasury` | AccessControl, ReentrancyGuard | BTSH/ETH treasury, role+threshold gated |
| `treasury/MultisigController` | — | Reference M-of-N multisig, 2-day delay |
| `governance/BITESHAGovernance` | Governor (+5 extensions) | DAO proposals/voting |
| `governance/BITESHATimelock` | TimelockController | 2-day execution delay |
| `governance/ProposalManager` | — | Off-chain metadata layer |
| `vesting/TokenVesting` | Ownable, ReentrancyGuard | Linear vesting + cliff + revoke |
| `libraries/Security` | (library) | Keyed-hash + EOA helpers |

## 2. System diagram

```
                         ┌─────────────────────────┐
        delegate votes   │   BTSH (ERC20Votes)     │
        ┌───────────────▶│   fixed 1B supply       │
        │                └─────────────┬───────────┘
        │                              │ voting power
 ┌──────┴───────┐            ┌─────────▼───────────┐      ┌──────────────────┐
 │  Holders /   │  propose   │  BITESHAGovernance  │ queue│  BITESHATimelock │
 │  Delegates   │───────────▶│  (OZ Governor)      │─────▶│  (2-day delay)   │
 └──────────────┘            └─────────────────────┘      └────────┬─────────┘
                                                                   │ executes
                                                          ┌────────▼─────────┐
                                                          │ BITESHATreasury  │
                                                          │ (BTSH/ETH, roles)│
                                                          └──────────────────┘

  Donor (USDC)        ┌──────────────────────┐  80%   ┌── Food fund ──▶ NYC food
  ─────────donate────▶│     CharityVault     │────────┤
                      │ immutable 80/20 split│  20%   └── Ops fund ───▶ logistics
                      └──────────┬───────────┘
                                 │ spend events (purpose + receiptHash)
                      ┌──────────▼───────────┐
                      │ TransparencyRegistry │  ← signed monthly report anchors
                      └──────────────────────┘

  TokenVesting ── releases team/advisor/contributor BTSH over time (separate)
```

## 3. Key design decisions

- **Funds vs. token are separate.** Charity money is **USDC in CharityVault**; the
  **BTSH** token is governance/receipt only. No coupling, no value-accrual.
- **Immutable charity policy.** `FOOD_BPS`/`OPS_BPS` are `constant`; not even the DAO
  can change the 80/20 split.
- **Rounding favours food.** The ops share is floored; the remainder (dust) goes to
  food, guaranteeing food ≥ 80% for any amount.
- **Custody is role-gated, not EOA-controlled.** Post-deploy, privileged roles sit with
  the Timelock / multisigs; the deployer renounces.
- **Reentrancy-safe.** All fund-moving functions use `nonReentrant` + SafeERC20.
- **Operational speed for charity.** Spending is multisig-gated (fast), not timelocked —
  feeding people cannot wait 2 days. Only the *split* is locked.

## 4. External dependencies & assumptions

- **USDC** — third-party, 6-decimal, upgradeable, pausable, blacklist-capable. The
  architecture treats it as trusted but the contract logic is decimals-agnostic and
  reentrancy-safe regardless. Impact of USDC pause/blacklist is an audit question.
- **OpenZeppelin v5** — assumed audited; we review integration, not internals.

## 5. Deployment & verification

- `scripts/deploy.js` — deploys all contracts, performs genesis mint, wires roles,
  transfers admin to Timelock, and **renounces deployer roles**. CharityVault +
  TransparencyRegistry deploy when `USDC_ADDRESS` is set.
- `scripts/verify.js` — block-explorer verification.
- `scripts/generate-report.js` / `verify-report.js` — monthly signed-report tooling.

## 6. Testing

165 Hardhat tests; 100% line & function coverage on all production contracts; ~89%
branch overall; randomized invariant fuzzing for CharityVault + TokenVesting. See
[TEST_REPORT.md](./TEST_REPORT.md).
