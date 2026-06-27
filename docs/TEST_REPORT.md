# BITESHA — Verification Report

> Objective evidence of build, test, and coverage status.
> Reproduce with: `npm install && npx hardhat compile && npx hardhat test && npx hardhat coverage`

---

## Compilation

```
Compiled 71 Solidity files successfully (evm target: cancun)
Solc version: 0.8.28 · Optimizer: enabled · Runs: 200 · viaIR: true
```

---

## Test Summary

```
162 passing
0 failing
```

> Pure donation+governance model: BTSHStaking (and its yield) removed — no profit
> mechanics. Includes CharityVault (37 tests, 80/20 split + on-chain meals counter)
> and TransparencyRegistry (16 tests, tamper-evident report anchoring).
> See [TOKEN_MODEL.md](./TOKEN_MODEL.md), [CHARITY.md](./CHARITY.md), [TRANSPARENCY.md](./TRANSPARENCY.md).

| Suite | Tests | Focus |
|---|---|---|
| BTSH Token | 9 | mint, pause, ERC20Permit, ERC20Votes delegation |
| CharityVault | 37 | 80/20 split, dust→food, meals counter, spend isolation, transparency |
| TransparencyRegistry | 16 | signed report anchoring, immutability, verify, enumeration |
| TokenVesting | 19 | cliff, linear unlock, revoke split-payout, validation |
| BITESHATreasury | 24 | role model, threshold gating, ETH timelock, events |
| MultisigController | 24 | M-of-N, delay, cancel, execute guards |
| BITESHAGovernance | 6 | name, threshold, propose, vote, delegation |
| Governance lifecycle | 5 | propose → vote → queue → execute, quorum, defeat |
| Integration | 5 | cross-contract flows, treasury drain resistance, governance via delegation |
| Libraries | 16 | keyed hash (length-extension safe), config allocations |

---

## Coverage

```
--------------------------|----------|----------|----------|----------|
File                      |  % Stmts | % Branch |  % Funcs |  % Lines |
--------------------------|----------|----------|----------|----------|
 charity/CharityVault.sol |      100 |    83.33 |      100 |      100 |
 charity/TransparencyReg…  |      100 |      100 |      100 |      100 |
 core/BTSH.sol            |      100 |    78.57 |      100 |      100 |
 core/BTSHTokenConfig.sol |      100 |      100 |      100 |      100 |
 governance/BITESHAGov…    |      100 |      100 |      100 |      100 |
 governance/ProposalMgr…   |      100 |       75 |      100 |      100 |
 governance/Timelock.sol  |      100 |      100 |      100 |      100 |
 libraries/Security.sol   |      100 |      100 |      100 |      100 |
 treasury/BITESHATreasury |      100 |    85.71 |      100 |      100 |
 treasury/MultisigCtrl…    |      100 |       95 |      100 |      100 |
 vesting/TokenVesting.sol |      100 |    91.18 |      100 |      100 |
--------------------------|----------|----------|----------|----------|
All files                 |    99.36 |    89.16 |    98.39 |    99.48 |
--------------------------|----------|----------|----------|----------|
```

**All production contracts: 100% lines & functions. Overall branches: 89.16%.**

The sub-100% overall stmt/line figure comes only from the test-only `MockUSDC`
harness; every production contract is at 100% lines and functions. The remaining
branch gap is defensive `require` short-circuits and OpenZeppelin-internal branches.

---

## Gas Report (selected)

| Contract | Method | Avg gas |
|---|---|---|
| BTSH | mintInitial | 125,414 |
| BTSH | transfer | 58,542 |
| BTSH | delegate | 95,641 |
| CharityVault | deposit | ~95,000 |
| CharityVault | spendFood | ~80,000 |
| Treasury | allocateBTSH | 69,387 |
| Governance | propose | 76,593 |
| Governance | queue | 146,689 |
| Governance | execute | 133,012 |

---

## Still Required Before Mainnet

These are **not** yet done and remain mandatory:

- [ ] Slither static analysis (no High/Critical)
- [ ] Mythril / symbolic execution pass
- [ ] Foundry fuzz + invariant tests (food ≥ 80% invariant, fund conservation, vesting conservation)
- [ ] Independent external audit (Trail of Bits / OpenZeppelin / Spearbit) — contracts **and** financial model
- [ ] Legal: NY AG charitable registration, 501(c)(3), securities opinion on BTSH
- [ ] Testnet deployment + multi-day live integration test
- [ ] Replace reference MultisigController with production Gnosis Safe (incl. independent reps)
