# BITESHA Foundation

**Building the Future of Digital Ecosystems**

BITESHA is an ecosystem-first Web3 platform. The BTSH token exists to power real utility — not speculation.

---

## Repository Contents

| Path | Description |
|---|---|
| `contracts/core/` | BTSH ERC-20 token + supply config |
| `contracts/vesting/` | Linear vesting with cliff (team, investors) |
| `contracts/treasury/` | Foundation treasury + multisig controller |
| `contracts/governance/` | DAO governance + timelock |
| `contracts/staking/` | BTSH staking with proportional rewards |
| `contracts/interfaces/` | Solidity interfaces |
| `contracts/libraries/` | Shared security helpers |
| `contracts/tests/` | Hardhat test suite |
| `scripts/` | Deploy + verify scripts |
| `deployments/` | On-chain addresses by network |
| `docs/` | Architecture, strategy, pitch deck |

---

## Token: BTSH

| Property | Value |
|---|---|
| Name | BITESHA |
| Ticker | BTSH |
| Max Supply | 1,000,000,000 (fixed, no inflation) |
| Network | Base (primary) / Arbitrum |
| Standard | ERC-20 + ERC20Votes + ERC20Permit |

**Design rules:**
- One-time genesis mint only
- No admin mint functions after genesis
- No hidden inflation
- Full supply locked in vesting / treasury at TGE

---

## Architecture

```
BITESHA Foundation (MultisigController)
        │
        ├── BITESHATreasury
        │       └── controls BTSH reserve
        │
        ├── BITESHAGovernance (DAO)
        │       └── BITESHATimelock (2-day delay)
        │
        ├── TokenVesting
        │       └── team, investors, advisors
        │
        └── BTSHStaking
                └── ecosystem rewards
```

---

## Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Base Sepolia testnet
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY and BASE_SEPOLIA_RPC
npm run deploy:testnet
```

---

## Decision Framework

Every change to this repository that affects smart contracts, tokenomics, or governance must pass **RFC-0001** filters:

0. **Integrity** — can we explain this decision with pride in 10 years?
1. **Vision** — aligns with long-term ecosystem mission?
2. **Community** — creates value for users and developers?
3. **Technology** — secure, auditable, scalable?
4. **Economics** — strengthens ecosystem sustainability?
5. **Longevity** — useful in 5–10 years?

See [docs/RFC-0001-Decision-Framework.md](docs/RFC-0001-Decision-Framework.md)

---

## Security

- Contracts are not yet audited (audit in progress — Phase 1, Day 25)
- Do not deploy to mainnet until audit is complete
- Report vulnerabilities privately to the foundation

---

## Documentation

- [RFC-0001 Decision Framework](docs/RFC-0001-Decision-Framework.md)
- [AI Founder System](docs/AI-Founder-System.md)
- [Investor Pitch Deck](docs/Investor-Pitch-Deck.md)
- [90-Day Execution Plan](docs/90-Day-Execution-Plan.md)
- [Launch Strategy](docs/Launch-Strategy.md)

---

## License

MIT — see [LICENSE](LICENSE)

---

> *You do not launch a token to get users. You launch users to justify a token.*  
> — BITESHA Founding Principle
