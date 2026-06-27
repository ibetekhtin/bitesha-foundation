# BITESHA Foundation

**Feeding people on the streets of New York — verifiably.**

BITESHA is a charitable ecosystem. Contributions flow through a smart contract that
splits them **80% food / 20% operations** and records every dollar on a public
blockchain. BTSH is a **donation receipt + governance token** — it has no yield, no
staking rewards, and no profit expectation. See [docs/TOKEN_MODEL.md](docs/TOKEN_MODEL.md).

---

## Repository Contents

| Path | Description |
|---|---|
| `contracts/core/` | BTSH ERC-20 (donation + governance) + supply config |
| `contracts/charity/` | CharityVault (80/20 split) + TransparencyRegistry |
| `contracts/vesting/` | Linear vesting with cliff (team, advisors, contributors) |
| `contracts/treasury/` | Foundation treasury + multisig controller |
| `contracts/governance/` | DAO governance + timelock |
| `contracts/interfaces/` | Solidity interfaces |
| `contracts/libraries/` | Shared security helpers |
| `contracts/tests/` | Hardhat test suite (162 passing) |
| `dashboard/` | Live, on-chain transparency dashboard |
| `scripts/` | Deploy, verify, and signed-report tooling |
| `docs/` | Mission, charity model, transparency, token model |

---

## Token: BTSH

| Property | Value |
|---|---|
| Name | BITESHA |
| Ticker | BTSH |
| Max Supply | 1,000,000,000 (fixed, no inflation) |
| Network | Base (primary) |
| Standard | ERC-20 + ERC20Votes + ERC20Permit |

**Design rules:**
- One-time genesis mint only; no admin mint after genesis; no hidden inflation
- **Donation + governance only** — no staking, no yield, no buybacks, no profit mechanics
- Voting power comes purely from ERC20Votes delegation

---

## Architecture

```
BITESHA Foundation (multisig incl. independent reps)
        │
        ├── CharityVault ──── immutable 80/20 food/ops split (USDC)
        ├── TransparencyRegistry ── signed monthly reports, anchored on-chain
        │
        ├── BITESHATreasury ── foundation BTSH reserve
        ├── BITESHAGovernance (DAO) ── BITESHATimelock (2-day delay)
        └── TokenVesting ── team, advisors, contributors (compensation)
```

---

## Setup

```bash
npm install
npm run compile
npm test

# Deploy to Base Sepolia testnet (set USDC_ADDRESS to enable the charity flow)
cp .env.example .env
npm run deploy:testnet
```

---

## Decision Framework

Every change affecting smart contracts, tokenomics, or governance must pass **RFC-0001**
filters — Filter 0 being **Integrity**: "could we explain this to a regulator in 10 years?"

See [docs/RFC-0001-Decision-Framework.md](docs/RFC-0001-Decision-Framework.md).

---

## Security & Compliance

- Contracts not yet independently audited — do not deploy to mainnet until complete.
- **Before any public fundraising:** NY AG charitable registration, 501(c)(3) status,
  and a securities-law opinion on BTSH. See [docs/CHARITY.md](docs/CHARITY.md).
- Report vulnerabilities privately to the foundation.

---

## Documentation

- [Mission & Donor Deck](docs/Mission-Deck.md)
- [Token Model — no profit expectation](docs/TOKEN_MODEL.md)
- [Charity Model — 80/20 split](docs/CHARITY.md)
- [Transparency System](docs/TRANSPARENCY.md)
- [Test / Coverage Report](docs/TEST_REPORT.md)
- [Audit Scope (for security auditors)](docs/AUDIT-SCOPE.md)
- [Legal Brief (for counsel)](docs/LEGAL-BRIEF.md)
- [RFC-0001 Decision Framework](docs/RFC-0001-Decision-Framework.md)

---

## License

MIT — see [LICENSE](LICENSE)

---

> *We are not building a token to get rich. We are building a way to feed people that
> anyone can audit.*
> — BITESHA Founding Principle
