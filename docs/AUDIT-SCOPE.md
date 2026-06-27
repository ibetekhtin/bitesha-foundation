# BITESHA — Smart Contract Audit Scope

Prepared for independent security auditors. This document defines the scope,
invariants, threat model, and existing test coverage so an engagement can be
priced and executed efficiently.

- **Repository:** github.com/ibetekhtin/bitesha-foundation
- **Commit to audit:** _pin the exact commit hash agreed at kickoff_
- **Language / compiler:** Solidity `^0.8.24`, compiled with solc `0.8.28`,
  optimizer enabled (200 runs), `viaIR: true`, `evmVersion: cancun`
- **Framework:** Hardhat. Dependencies: OpenZeppelin Contracts v5.x
- **Target chains:** Base (primary), EVM L2 generally
- **Existing tests:** 165 passing (Hardhat) incl. randomized invariant fuzzing
- **Project type:** charitable DAO; BTSH is a donation + governance token with
  **no yield / no profit mechanics** (see TOKEN_MODEL.md)

---

## 1. Contracts in scope

| Contract | SLOC | Purpose | Risk |
|---|---|---|---|
| `charity/CharityVault.sol` | 173 | Holds USDC; immutable 80/20 food/ops split; gated spending | **Critical** — custodies donor funds |
| `charity/TransparencyRegistry.sol` | 99 | Anchors signed monthly report hashes | Medium — integrity of reporting |
| `core/BTSH.sol` | 60 | ERC20 + Permit + Votes; fixed-supply governance token | High — token + voting weight |
| `core/BTSHTokenConfig.sol` | 24 | Distribution constants (library) | Low — pure constants |
| `treasury/BITESHATreasury.sol` | 85 | Foundation BTSH/ETH treasury, role-gated allocation | **Critical** — custodies treasury |
| `treasury/MultisigController.sol` | 99 | Reference M-of-N multisig w/ 2-day delay | High — to be replaced by Gnosis Safe |
| `governance/BITESHAGovernance.sol` | 98 | OZ Governor (votes, quorum, timelock control) | High — controls treasury via DAO |
| `governance/Timelock.sol` | 17 | OZ TimelockController, 2-day delay | High |
| `governance/ProposalManager.sol` | 38 | Off-chain metadata layer (no vote effect) | Low |
| `vesting/TokenVesting.sol` | 114 | Linear vesting w/ cliff + revoke | High — custodies vested tokens |
| `libraries/Security.sol` | 48 | Keyed-hash + EOA helpers | Low |
| `interfaces/*` | ~34 | Interfaces only | Informational |

**Out of scope:** `contracts/tests/**` (incl. `MockUSDC`, `LibHarness`),
`dashboard/`, `scripts/`. Third-party OpenZeppelin code is assumed audited; review
its **integration**, not its internals.

Total in-scope production SLOC: **~889**.

---

## 2. Trust / privilege model

| Role | Held by (intended) | Powers |
|---|---|---|
| BTSH `owner` | Foundation multisig → DAO | one-time `mintInitial`, pause/unpause transfers |
| Treasury `DEFAULT_ADMIN_ROLE` | Timelock (deployer renounces) | grant/revoke roles |
| Treasury `GOVERNOR_ROLE` | Timelock | allocate BTSH < 1M threshold |
| Treasury `TIMELOCK_ROLE` | Timelock | allocate BTSH ≥ 1M, all ETH |
| CharityVault `DEFAULT_ADMIN_ROLE` | Foundation multisig (w/ independent reps) | grant/revoke spender roles |
| CharityVault `FOOD_SPENDER_ROLE` / `OPS_SPENDER_ROLE` | Operations multisig | spend from respective fund |
| TransparencyRegistry `PUBLISHER_ROLE` | Multisig w/ independent reps | anchor monthly reports |
| Governor / Timelock proposer | Governor contract | queue/execute passed proposals |
| Vesting `owner` | Foundation multisig | create/revoke schedules |

**Key assumption to validate:** post-deployment, **no EOA** retains privileged
roles; admin is transferred to Timelock/multisig and the deployer renounces.
The deploy script (`scripts/deploy.js`) performs this — please verify it is
complete and not bypassable.

---

## 3. Invariants (please verify / attempt to break)

### CharityVault (highest priority — custodies funds)
- **I-1 Conservation:** `totalToFood + totalToOps == totalReceived` at all times.
- **I-2 Food floor:** `totalToFood * 10000 >= totalReceived * 8000` — food always
  receives ≥ 80%; rounding dust must favour food, never operations.
- **I-3 Spend bound:** `totalSpentFood <= totalToFood` and `totalSpentOps <= totalToOps`.
- **I-4 Availability identity:** `availableFood == totalToFood - totalSpentFood`
  (same for ops); neither can underflow.
- **I-5 Solvency:** `foodBalance + opsBalance == USDC.balanceOf(vault)` (with `sync()`
  reconciling direct transfers). The vault can never owe more than it holds.
- **I-6 Fund isolation:** spending from one fund cannot reduce the other.
- **I-7 Immutability:** `FOOD_BPS`/`OPS_BPS` are `constant` — no path changes the split.

### BTSH
- **I-8 Supply cap:** total minted ≤ `MAX_SUPPLY`; `mintInitial` callable exactly once.
- **I-9 Votes integrity:** voting power derives only from delegated balance; no mint
  after genesis can inflate it.
- **I-10 Pause safety:** paused transfers cannot strand `ERC20Votes` checkpoints
  inconsistently.

### Treasury
- **I-11 Threshold gating:** allocations ≥ 1M BTSH require `TIMELOCK_ROLE`; all ETH
  requires `TIMELOCK_ROLE`. Confirm the **split-allocation** bypass (many sub-threshold
  calls) is acceptable / mitigated.

### TokenVesting
- **I-12 Vesting bound:** `vested <= total`; `released <= vested`; post-duration
  `released == total` exactly (never more).
- **I-13 Revoke correctness:** on revoke, vested-but-unclaimed goes to beneficiary,
  unvested to owner, sum == remaining balance; double-claim impossible.

### Governance / Timelock
- **I-14** Only the Governor can queue; execution requires the full 2-day delay;
  defeated/under-quorum proposals cannot execute.

> CharityVault I-1..I-5 and Vesting I-12..I-13 already have **randomized invariant
> fuzz tests** (`contracts/tests/invariants.test.js`, 300 ops + 200 adversarial tiny
> deposits + 60 vesting time-steps). We ask auditors to attempt to break them with
> deeper symbolic/fuzz tooling.

---

## 4. Threat model — areas of concern

1. **Rounding / dust direction** (CharityVault) — confirm food never drops below 80%
   for any amount, incl. 1-unit deposits and `sync()` of arbitrary balances.
2. **Reentrancy** — all fund-moving functions use `nonReentrant` + SafeERC20. Verify
   no cross-function reentrancy (e.g. via a malicious `stablecoin` — note USDC is
   trusted, but the pattern should be safe regardless).
3. **Access-control completeness** — every state-changing function gated correctly;
   no missing modifier; admin renounce path is final and correct.
4. **Treasury split-allocation** — repeated sub-threshold `allocateBTSH` calls to
   evade the 1M timelock requirement. Is the on-chain threshold sufficient, or is an
   additional rate/period cap needed?
5. **Governance capture** — quorum (4%) and proposal threshold (100k BTSH) parameters;
   flash-delegation / vote-buying surface; timelock as last line of defence.
6. **MultisigController** — reference implementation; we plan to replace with Gnosis
   Safe. Audit lightly but flag any footguns if it ships as-is.
7. **TransparencyRegistry** — period validation, immutability of anchored reports,
   inability to overwrite history.
8. **ERC20Votes / ERC20Permit integration** in BTSH — the `_update` / `nonces`
   override correctness (multiple-inheritance diamond).
9. **Stablecoin assumptions** — USDC is 6-decimal, upgradeable, pausable, blacklist-
   capable. Assess impact if USDC pauses/blacklists the vault.
10. **DoS / griefing** — unbounded loops (`MultisigController` signer loop,
    `TransparencyRegistry.periods`), gas limits in batch paths.

---

## 5. Existing coverage (so you can focus)

- 165 Hardhat tests, **100% line & function coverage on all production contracts**,
  ~89% branch overall. See `docs/TEST_REPORT.md`.
- Randomized invariant fuzzing for CharityVault + TokenVesting.
- Full governance lifecycle test (propose → vote → queue → execute) exercised.
- Treasury drain-resistance after role renounce is tested.

**Not yet done (we expect this from the engagement or in parallel):**
Slither, Mythril/symbolic execution, formal verification of I-1..I-7, economic /
financial-model review (tokenomics + the 80/20 policy against real cost structure).

---

## 6. Deliverables requested

1. Findings report by severity (Critical / High / Medium / Low / Informational).
2. Explicit pass/fail on invariants I-1..I-14.
3. Assessment of the privilege model and deploy-time role transfer.
4. Opinion on the treasury split-allocation question (§4.4).
5. Remediation review of fixes.

---

## 7. Contacts & logistics

- Primary technical contact: _foundation eng lead_
- Preferred disclosure: private until fixes deployed
- Code freeze commit + branch: _agree at kickoff_
