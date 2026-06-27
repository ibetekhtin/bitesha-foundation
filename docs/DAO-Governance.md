# BITESHA — DAO Governance

How decisions are made in BITESHA. Implemented with OpenZeppelin Governor +
TimelockController.

---

## 1. Components

| Contract | Role |
|---|---|
| `BTSH` (ERC20Votes) | Voting weight source — via delegation |
| `BITESHAGovernance` | OZ Governor: proposals, voting, counting, quorum |
| `BITESHATimelock` | 2-day delay between a passed proposal and execution |
| `ProposalManager` | Off-chain-friendly metadata (title, discussion link); no vote effect |

## 2. Parameters (as configured)

| Parameter | Value | Source |
|---|---|---|
| Voting delay | 1 day | `GovernorSettings` |
| Voting period | 7 days | `GovernorSettings` |
| Proposal threshold | 100,000 BTSH | `GovernorSettings` |
| Quorum | 4% of supply (40,000,000 BTSH) | `GovernorVotesQuorumFraction` |
| Timelock delay | 2 days | `BITESHATimelock` |
| Vote counting | For / Against / Abstain | `GovernorCountingSimple` |

## 3. Voting power

Voting power comes **only** from delegated BTSH balance (ERC20Votes checkpoints).
A holder must `delegate` (to self or another address) to activate voting weight. There
is **no staking** — holding + delegating is the entire mechanism. Snapshots are taken
at proposal creation, preventing buying votes mid-vote for already-open proposals.

## 4. Lifecycle

```
1. Propose      — any holder with ≥ 100k delegated BTSH calls propose()
2. Voting delay — 1 day before voting opens (snapshot taken)
3. Active       — 7-day voting window (For / Against / Abstain)
4. Succeeded    — quorum (4%) reached AND For > Against
5. Queue        — queued into the Timelock
6. Timelock     — 2-day mandatory delay
7. Execute      — anyone executes after the delay
```

Defeated or under-quorum proposals cannot be queued or executed. The full lifecycle
(propose → vote → queue → execute), the defeat path, and the quorum-failure path are
covered by tests (`contracts/tests/governance-lifecycle.test.js`).

## 5. What governance controls

- Treasury allocations (BTSH and ETH), subject to the treasury's own role/threshold
  gating — large allocations require the timelock path.
- Protocol parameters changeable via governance.
- Foundation-level decisions the community should steer.

**What governance does NOT control:** the **80/20 charity split** is immutable in
`CharityVault` and is deliberately **not** governable — a charity promise that the DAO
could vote to change is not a promise.

## 6. Privilege handoff

At deployment, the Timelock receives admin/role control of the Treasury and the
deployer EOA renounces its roles, so the DAO (via Timelock) — not any individual —
governs privileged actions. See [Security-Architecture.md](./Security-Architecture.md).

## 7. Future hardening

- Replace the reference `MultisigController` with Gnosis Safe (incl. independent reps).
- Consider a Governor guardian / veto for emergencies, with transparent scope.
- Publish a governance forum + the `ProposalManager` metadata convention.
