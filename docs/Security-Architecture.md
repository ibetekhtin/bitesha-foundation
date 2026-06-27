# BITESHA — Security Architecture

How the system protects donor and treasury funds. Pairs with
[AUDIT-SCOPE.md](./AUDIT-SCOPE.md) (which lists invariants + threat model for auditors).

---

## 1. Security principles

1. **No single EOA controls funds.** Privileged roles are held by the Timelock and
   multisigs (intended: Gnosis Safe with independent representatives), not individuals.
2. **Least privilege.** Each role grants the minimum needed; spend roles are separate
   from admin roles; food and ops spending are separate roles.
3. **Immutable promises.** The 80/20 split is `constant` — unchangeable by anyone.
4. **Defence in depth.** Role gating + thresholds + timelock + reentrancy guards +
   conservative rounding.
5. **Transparency as security.** Every fund movement emits events; monthly reports are
   signed and anchored; anyone can audit.

## 2. Access control model

| Asset | Guard |
|---|---|
| BTSH mint | `onlyOwner`, one-time `mintInitial`, capped at `MAX_SUPPLY` |
| BTSH pause | `onlyOwner` (intended: DAO/multisig) |
| Treasury BTSH < 1M | `GOVERNOR_ROLE` |
| Treasury BTSH ≥ 1M / all ETH | `TIMELOCK_ROLE` (DAO + 2-day delay) |
| CharityVault food spend | `FOOD_SPENDER_ROLE` (multisig) |
| CharityVault ops spend | `OPS_SPENDER_ROLE` (multisig) |
| CharityVault role admin | `DEFAULT_ADMIN_ROLE` (multisig incl. independent reps) |
| Report anchoring | `PUBLISHER_ROLE` (multisig incl. independent reps) |
| Vesting create/revoke | `onlyOwner` (foundation multisig) |
| Governance execution | Timelock, 2-day delay, Governor-only proposer |

**Post-deployment invariant:** the deployer EOA renounces all privileged roles; admin
sits with the Timelock/multisig. Enforced by `scripts/deploy.js`; flagged for auditor
verification.

## 3. Threat mitigations (implemented)

| Threat | Mitigation |
|---|---|
| Reentrancy | `nonReentrant` on all fund-moving fns; SafeERC20; checks-effects-interactions |
| Rounding drain / underfunding charity | Ops share floored, dust → food; food ≥ 80% proven by fuzzing |
| Fund insolvency | Invariant: `availableFood + availableOps == vault USDC balance` |
| Cross-fund theft | Food/ops balances isolated; spend bounded by per-fund available |
| Privileged-EOA compromise | Roles transferred to Timelock/multisig; deployer renounces |
| Large treasury drain | ≥1M BTSH and all ETH require timelock (DAO + delay) |
| Governance flash-vote | ERC20Votes snapshot at proposal creation; quorum + threshold |
| Tampered reports | `TransparencyRegistry` anchors immutable signed hashes |
| Length-extension on keyed hash | `abi.encode` (not packed); documented as not-HMAC |
| Double-claim / over-vest | Vesting bounds `released ≤ vested ≤ total`; tested + fuzzed |

## 4. Known residual risks (for audit / ops)

- **Treasury split-allocation:** many sub-1M `allocateBTSH` calls could evade the
  timelock threshold. Open question for auditors: add a rate/period cap?
- **USDC dependency:** if USDC pauses or blacklists the vault, funds could be frozen.
  Operational mitigation: diversify or monitor; assess in audit.
- **MultisigController is a reference impl** — to be replaced by Gnosis Safe before
  mainnet.
- **Off-chain spend integrity:** code cannot guarantee withdrawn food funds buy food;
  accountability via receipts + independent multisig reps.

## 5. Operational security (pre-launch checklist)

- [ ] Independent smart-contract audit (Trail of Bits / OpenZeppelin / CertiK / Halborn / Nethermind)
- [ ] Slither + Mythril clean of High/Critical
- [ ] Multisig signers set, including independent representatives; keys on hardware
- [ ] Gnosis Safe replaces reference multisig
- [ ] Deploy script dry-run on testnet; verify role renounce is complete
- [ ] Incident-response + key-compromise runbook
- [ ] Annual independent **financial** audit of charity fund movement

## 6. Testing evidence

165 tests, 100% line/function coverage on production contracts, randomized invariant
fuzzing. Full report: [TEST_REPORT.md](./TEST_REPORT.md). Invariants enumerated for
auditors in [AUDIT-SCOPE.md](./AUDIT-SCOPE.md) §3.
