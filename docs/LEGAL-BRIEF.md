# BITESHA — Briefing for Legal Counsel

> **Purpose:** give counsel the factual basis to advise on structuring BITESHA.
> This document is prepared by the engineering team and is **not legal advice**.
> Nothing here should be treated as a conclusion of law. All "design intents"
> below are subject to counsel's review and may need to change.

---

## 1. One-paragraph summary

BITESHA is a charitable initiative whose mission is feeding people on the streets
of New York. Supporters contribute funds (in USDC, a stablecoin); a smart contract
("CharityVault") automatically and immutably splits every contribution **80% to food
procurement / 20% to operations**, and records all flows on a public blockchain.
Contributors receive **BTSH**, a fixed-supply token that functions as a **donation
receipt and a governance (voting) right** in the project's DAO. BTSH is deliberately
designed with **no yield, no staking rewards, no buybacks, and no profit mechanics**.
We need counsel on entity structure, charitable-solicitation registration, tax status,
securities characterization of BTSH, money-transmission, and food-safety compliance —
primarily under US federal law and New York State law.

---

## 2. Token structure (BTSH)

| Attribute | Value |
|---|---|
| Standard | ERC-20 with ERC20Votes (on-chain voting) + ERC20Permit |
| Supply | 1,000,000,000 fixed; one-time genesis mint; no inflation; no post-genesis minting |
| Yield / staking | **None.** Staking and all reward mechanics were deliberately removed |
| Buyback / revenue share | **None** |
| Holder rights | (a) governance vote in the DAO; (b) serves as a donation receipt |
| Transferability | Transferable ERC-20; may trade on secondary markets (DEX) |
| Pausability | Owner (intended: DAO/multisig) can pause transfers |

**Genesis distribution (design intent, encoded in `BTSHTokenConfig`):**

| Bucket | % | Note |
|---|---|---|
| Ecosystem & growth of the mission | 30% | 4-yr linear vesting |
| Foundation treasury | 20% | DAO-controlled |
| Team (compensation for work) | 15% | 1-yr cliff + 3-yr linear |
| Community & DAO governance | 15% | governance distribution, not yield |
| Charity reserve | 10% | long-term reserve, DAO-governed |
| Public donation round | 5% | available at launch |
| DEX liquidity | 5% | locked 1 year |

There is **no "private investor" allocation** — that bucket was intentionally removed.

---

## 3. Fund flows (where the money goes)

```
Supporter contributes USDC
        │
        ▼
   CharityVault (smart contract)
        │  immutable split, enforced in code
        ├── 80% → Food fund    → withdrawn by FOOD_SPENDER (multisig) to buy
        │                          food from NYC suppliers (off-chain, in USD)
        └── 20% → Operations    → logistics, volunteers, legal, admin
        │
        ▼
   Supporter receives BTSH (donation receipt + governance vote)
```

- Funds are held in **USDC** (a third-party stablecoin), not in BTSH, so the food
  budget is not exposed to crypto price volatility.
- Spending requires a multisig role and logs an on-chain purpose + receipt hash.
- A separate `TransparencyRegistry` anchors cryptographically signed **monthly
  reports** (receipts, photos, video via IPFS) on-chain.
- **On-chain code guarantees the split + transparency; it does NOT and cannot
  guarantee the 80% is physically spent on food** — that is an off-chain action,
  evidenced by published receipts and multisig control.

---

## 4. Marketing / messaging posture (for counsel to review)

Engineering's intent is to keep all public messaging in the **donation / impact**
register and avoid any investment framing. Current rules we are applying:

**We intend to say:** "donate / contribute," "feed people," "transparent / verifiable,"
"governance," "impact," "meals funded."

**We intend to NEVER say:** "invest / investment," "returns / ROI / yield,"
"price target / appreciation," "early investors," "profit," "get rich," "to the moon,"
or anything implying financial gain from holding BTSH.

The pitch materials were rewritten accordingly (`docs/Mission-Deck.md` carries an
explicit "not an investment offer" disclaimer). **We ask counsel to review and approve
all public-facing language before launch.**

---

## 5. Specific questions for counsel

### Entity & charitable status
1. Optimal entity structure (e.g. 501(c)(3) nonprofit, fiscal sponsorship, foundation)
   for accepting crypto donations and distributing food in NYC?
2. Are contributions "donations" (potentially tax-deductible) given contributors
   receive BTSH in return? Does receiving a token negate deductibility?

### Charitable solicitation
3. **New York State Attorney General, Charities Bureau** registration requirements
   before soliciting contributions from NY residents — and multi-state implications
   if solicitation is online/global.

### Securities (the central question)
4. Under the **Howey test**, is BTSH a security given: (a) it is sold/distributed for
   value, (b) it confers governance rights, (c) it is transferable and may trade on
   secondary markets, but (d) it carries **no profit mechanics** and is marketed solely
   as a donation receipt + governance right with no return expectation?
5. Does the existence of a **secondary market / DEX liquidity** (where price could
   rise) create a profit expectation even if the project never promises one? How should
   we structure liquidity / messaging to minimize this risk?
6. Do the **team / ecosystem vesting** allocations or the DAO treasury change the
   analysis?

### Money transmission / MSB
7. Does accepting USDC and converting it to USD to buy food implicate **FinCEN MSB**
   registration or **NY BitLicense / money-transmitter** licensing? Does using a
   regulated third party (e.g. exchange / payment processor) for the crypto→fiat step
   change this?

### Operations
8. **Food-safety / health permits** for distributing food on NYC streets (NYC DOHMH).
9. **AML/KYC** obligations on contributors, if any, at expected contribution sizes.
10. Tax treatment of the DAO treasury and of team token compensation.

---

## 6. What we can change in code if counsel advises

The architecture is flexible. If counsel recommends it, we can, for example:
- Make BTSH **non-transferable** or transfer-restricted (soulbound-style) to further
  distance it from a tradeable investment.
- Remove or delay DEX liquidity.
- Add contribution caps, allowlists, or KYC gating at the contract level.
- Adjust the distribution buckets or vesting terms.

We would rather adjust the design early than retrofit under pressure.

---

## 7. Reference materials (in repo)

- `docs/TOKEN_MODEL.md` — the no-profit design and rationale
- `docs/CHARITY.md` — the 80/20 model + on-chain/off-chain boundary
- `docs/TRANSPARENCY.md` — reporting system + a preliminary Howey note
- `docs/Mission-Deck.md` — current public-facing framing
- `contracts/charity/CharityVault.sol` — the fund-handling contract

> Again: this brief states facts and design intents for counsel's analysis. It is not
> legal advice and reaches no legal conclusions.
