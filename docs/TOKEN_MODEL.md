# BTSH — Token Model (Donation + Governance, No Profit Expectation)

BTSH is deliberately designed **not** to be an investment instrument. It is a
**donation receipt + governance token**. This document records the design decisions
that back that claim, so the architecture — not just the marketing — supports a
"no profit expectation" posture under the US **Howey test**.

## The Howey reality

A "charity token" label does not exempt anything. Howey asks whether there is an
investment of money in a common enterprise **with an expectation of profit derived
from the efforts of others**. Regulators look at economic reality and how the token
is structured and marketed — not the name. So we remove the profit mechanics at the
architecture level.

## What BTSH deliberately does NOT have

| Removed / excluded | Why it would signal profit expectation |
|--------------------|----------------------------------------|
| **Staking rewards / yield** (`BTSHStaking` removed) | Paying token holders a return looks like interest/dividend — a textbook profit expectation. |
| **Private-investor allocation** (`INVESTORS_BP` removed) | "Investors" implies an expectation of financial return. Replaced with a DAO-governed **charity reserve**. |
| **"Rewards" framing** in community allocation | Renamed to community & DAO **governance** distribution — voice, not yield. |
| **Buyback / price-support mechanics** | None exist, and none should be added — they manufacture price-appreciation expectation. |

## What BTSH IS

- A **donation receipt**: buying/donating routes funds through `CharityVault`, which
  splits them 80% food / 20% operations (immutable).
- A **governance right**: holding (and delegating) BTSH gives a vote in how the
  foundation is run, via `BITESHAGovernance`. Voting power comes purely from
  `ERC20Votes` delegation of the token balance — there is no staking layer.
- **Fixed supply, no inflation**: genesis mint only. Holders are not diluted, and
  there is no emission schedule that resembles a yield program.

## Vesting is compensation, not investment

`TokenVesting` covers **team, advisors, and contributors** — compensation for work on
the mission, with a cliff and linear unlock. There is no investor tranche. The word
"investor" has been removed from the codebase.

## Guardrails to keep this true

1. **Do not add** staking yield, buybacks, revenue-share, or any "earn" mechanic to BTSH.
2. **Marketing must match the architecture**: talk about donation and impact, never
   "returns," "ROI," "price targets," or "early investors."
3. Keep the **donation flow** (`CharityVault`) conceptually separate from any
   secondary-market trading of BTSH.
4. Get a **securities-law opinion** on structure *and* messaging before any public
   round — this document reduces risk but is not legal advice. See
   [CHARITY.md](./CHARITY.md) and [TRANSPARENCY.md](./TRANSPARENCY.md) for the
   companion compliance items.

> Engineering removed the profit mechanics. Keep marketing and legal aligned with that,
> and the "no profit expectation" position is something the architecture actually backs up.
