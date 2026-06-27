# BITESHA — Whitepaper

**Version 0.1 (pre-audit, pre-legal-review draft)**
_Feeding people on the streets of New York — verifiably._

> This whitepaper describes design intent. The project must not solicit funds publicly
> until smart-contract audit and legal review are complete. See
> [LEGAL-BRIEF.md](./LEGAL-BRIEF.md) and [AUDIT-SCOPE.md](./AUDIT-SCOPE.md).

---

## 1. Abstract

BITESHA is a charitable ecosystem that turns giving from "trust us" into "verify us."
Supporters contribute stablecoin (USDC); an immutable smart contract splits every
contribution **80% to food procurement / 20% to operations** and records all movement
on a public blockchain. Contributors receive **BTSH**, a fixed-supply token that acts
as a **donation receipt and a governance vote** — with no yield, no staking, and no
profit mechanics. Monthly, cryptographically signed reports anchor receipts, photos,
and video on-chain so anyone can reconcile what was promised against what was done.

## 2. The problem

Charitable giving suffers a trust gap: donors rarely see where money actually goes,
overhead is opaque, and reporting is an annual PDF taken on faith. People go hungry on
NYC streets daily while well-meaning donors hesitate because they cannot verify impact.

## 3. The BITESHA approach

| Layer | Mechanism |
|---|---|
| Contribution | USDC into `CharityVault` |
| Allocation | Immutable 80/20 split, enforced in code |
| Custody | Stablecoin (no volatility on the food budget) |
| Spending | Multisig-gated, each spend logs purpose + receipt hash |
| Reporting | Signed monthly reports anchored via `TransparencyRegistry` |
| Governance | BTSH holders vote in the BITESHA DAO |
| Impact metric | On-chain `totalMealsFunded` counter |

## 4. What is provable vs. what is not

**Provable on-chain:** the 80/20 split, total received, allocated, spent; the
immutability of the split; the integrity (non-alteration) of each monthly report.

**Not provable on-chain — secured by accountability instead:** that the 80% is
physically spent on food. That final step happens in the real world and is evidenced by
published receipts, photos, video, and multisig control including independent
representatives. We state this plainly; a charity that overstates its technology is not
trustworthy.

## 5. The token (summary)

BTSH is an ERC-20 (with ERC20Votes + ERC20Permit), fixed supply 1,000,000,000, minted
once at genesis, no inflation. It is a **donation receipt + governance right**, not an
investment. Full detail in [TOKEN_MODEL.md](./TOKEN_MODEL.md) and
[Tokenomics.md](./Tokenomics.md).

## 6. Governance (summary)

An OpenZeppelin Governor + 2-day Timelock. Voting power comes purely from delegated
BTSH. Proposals that pass are executed only after the timelock delay. Full detail in
[DAO-Governance.md](./DAO-Governance.md).

## 7. Architecture (summary)

Eleven production contracts (~889 SLOC) on Base. Full map in
[Smart-Contract-Architecture.md](./Smart-Contract-Architecture.md); security model in
[Security-Architecture.md](./Security-Architecture.md).

## 8. Roadmap (summary)

Audit → legal → charitable structure → regulatory review → compliance → public launch.
Full detail in [Roadmap.md](./Roadmap.md).

## 9. Risks & honesty

- **Legal/regulatory:** token + fundraising in the US is heavily regulated; we are
  pursuing securities, charitable-solicitation, MSB, and food-safety review before
  launch.
- **Off-chain execution:** code cannot force food to be bought; accountability does.
- **Smart-contract risk:** unaudited code must not custody public funds; independent
  audit precedes launch.
- **No financial return:** BTSH is not designed to appreciate and is not marketed as
  an investment.

## 10. Conclusion

BITESHA's thesis is simple: make charitable giving auditable end-to-end. The technology
guarantees the split and the transparency; people, receipts, and independent oversight
guarantee the rest — and we are explicit about which is which.
