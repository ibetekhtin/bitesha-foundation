# Cover Email — Smart-Contract Audit Request

> Paste into the firm's "Request an audit" form or email. Fill the `[…]` blanks.
> Send to 3–5 firms in parallel (OpenZeppelin, Trail of Bits, CertiK, Halborn, Nethermind).

---

**Subject:** Audit request — BITESHA (charity DAO, ~889 SLOC, Solidity/OZ v5, Base)

Hello [Firm] team,

We'd like to request a security audit and a quote.

**Project.** BITESHA is a charitable project — funds feed people on the streets of New
York, with all flows on-chain and transparent. Contributions (USDC) pass through a
smart contract that immutably splits them 80% food / 20% operations. The token (BTSH) is
a donation-receipt + governance token with **no yield and no profit mechanics**.

**Codebase.**
- Repo (public): https://github.com/ibetekhtin/bitesha-foundation
- Freeze commit: `746338f210483e6a8e1396142807c84c4f52ad63`
- Solidity 0.8.28, OpenZeppelin v5, Hardhat, target chain Base (L2)
- 11 production contracts, ~889 SLOC
- 165 tests, 100% line coverage on production contracts, plus randomized invariant
  fuzzing (food ≥ 80%, fund conservation, solvency)

**Scope & invariants.** We've prepared a scope document with the contract list, trust
model, 14 named invariants, and a threat model:
`docs/AUDIT-SCOPE.md` in the repo.

**Highest-risk contracts:** `CharityVault` (custodies donor USDC, the 80/20 split) and
`BITESHATreasury`.

**What we're asking for:**
1. A quote (price + timeline + earliest start date).
2. Manual review + remediation re-review + a final public report.
3. Explicit pass/fail on the invariants in §3 of the scope doc.

**Context that may matter for scheduling:** this is a charity; we intend to publish your
final report openly for donor transparency.

Could you share a quote and your next availability? Happy to hop on a call.

Thank you,
[Your name]
[Role / BITESHA Foundation]
[Email] · [Telegram/phone if used]
