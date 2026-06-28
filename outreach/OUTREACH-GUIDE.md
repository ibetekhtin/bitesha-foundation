# BITESHA — Outreach Playbook (Turnkey)

Everything needed to launch **Stage 2 (audit)** and **Stage 3 (legal)**. Copy, fill the
`[…]` blanks, attach, send.

> What you (human) must do that I (assistant) cannot: actually send the emails, sign
> engagement letters, and pay invoices. Everything up to "press send" is prepared here.

---

## Reference facts (use in every message)

| Item | Value |
|---|---|
| Project | BITESHA Foundation — charity that feeds people in NYC, on-chain transparent |
| Repo | https://github.com/ibetekhtin/bitesha-foundation |
| **Audit freeze commit** | `746338f210483e6a8e1396142807c84c4f52ad63` (short `746338f`) |
| Stack | Solidity 0.8.28, OpenZeppelin v5, Hardhat, Base (L2) |
| Size | 11 production contracts, ~889 SLOC |
| Tests | 165 passing, 100% line coverage, invariant fuzzing |
| Token | BTSH — donation + governance, no yield/profit mechanics |
| Scope doc | `docs/AUDIT-SCOPE.md` |
| Legal brief | `docs/LEGAL-BRIEF.md` |
| Docs archive (for lawyers) | `~/Downloads/bitesha-docs-package.zip` |

---

# STAGE 2 — Smart-Contract Audit

## Step 1 — Freeze the code
Done: the commit above is your freeze point. Do **not** push contract changes until the
audit finishes (docs are fine to edit). If you must change code, tell the auditor and
re-pin.

## Step 2 — Pick firms and request quotes (contact all 3–5 in parallel)

| Firm | How to request | Notes |
|---|---|---|
| **OpenZeppelin** | openzeppelin.com → "Request audit" / security@openzeppelin.com | Gold standard for OZ-based code (you use OZ v5) |
| **Trail of Bits** | trailofbits.com → Contact / "Request a security review" | Top-tier, deep; longer lead time |
| **CertiK** | certik.com → "Request a quote" | Well-known brand, marketing visibility |
| **Halborn** | halborn.com → Contact | Strong on protocol audits |
| **Nethermind** | nethermind.io/smart-contract-audits → Contact | Good value, EVM-savvy |

> Verify the current contact URL on each site (forms change). Most have a "Get an audit"
> form — paste the cover letter below into the message field.

## Step 3 — Send the cover letter
Use `outreach/audit-cover-email.md`. Give them: repo link + freeze commit + point them to
`docs/AUDIT-SCOPE.md`. The repo is public, so no NDA needed to start; they can clone
immediately.

## Step 4 — Compare quotes
Expect replies with scope confirmation, **price**, **timeline**, and start date.
- **Ballpark cost:** ~889 SLOC → typically **$15k–$60k** depending on firm/brand
  (top-tier brands cost more). Get 3 quotes to calibrate.
- **Timeline:** usually **1–3 weeks** of active review after a scheduling queue of
  2–6 weeks.

## Step 5 — Engage & run
Standard flow: sign engagement → audit → **findings report** → you remediate → auditors
**re-review** the fixes → **final public report**. Budget time for the remediation round.

## Step 6 — After the report
- Fix everything Critical/High (and Medium where sensible).
- Publish the final report (in repo `docs/audit/` and on the site) — transparency.
- Re-pin a new commit if code changed.

### Red flags when choosing an auditor
- No remediation re-review included. - Only automated tooling, no manual review.
- Won't share a sample report. - Pressure to skip scope discussion.

---

# STAGE 3 — Legal Review

## Step 1 — Target the right kind of firm
You need a US firm (or team) covering **all four** at once:
**crypto/digital assets + DAO + nonprofit/charity law + US securities**.

Where to find them:
- **Crypto-native boutiques** that publicly advertise token + DAO work (search:
  "token securities counsel", "DAO legal counsel US", "crypto nonprofit lawyer").
- **Larger firms with a digital-assets practice** that also have a nonprofit/tax-exempt
  group (so securities + 501(c)(3) sit under one roof).
- Ask for **referrals** in crypto-nonprofit circles (e.g. other transparent-giving
  projects, Endaoment-style orgs, crypto-philanthropy communities).
- **Vet for:** a) actual token/securities (Howey) opinions shipped; b) 501(c)(3) /
  charitable-solicitation experience; c) familiarity with money-transmission/MSB.

> I'm intentionally not naming specific law firms as "the one" — for legal counsel you
> should verify current specialization and conflicts yourself, and ideally get 2–3
> referrals. The cover letter below is firm-agnostic.

## Step 2 — What to send
- `outreach/legal-cover-email.md` (below) in the body.
- Attach **`~/Downloads/bitesha-docs-package.zip`** (docs only — lawyers don't need the
  code) **or** link `docs/00-PROJECT-PACKAGE.md` and `docs/LEGAL-BRIEF.md`.
- The 10 questions in `LEGAL-BRIEF.md §5` are your agenda for the first call.

## Step 3 — First consultation
- Most firms offer a **paid initial consultation** (often $300–$750/hr, or a flat intro).
- Goal of call #1: confirm they cover all four areas, surface the **biggest risks**
  (Howey + charitable registration), and get a **scope + fee estimate** for a written
  opinion.
- **Ballpark:** a structured token/charity legal opinion commonly runs **$10k–$50k+**
  depending on depth and firm. Charitable registration filings are additional.

## Step 4 — Decision points they'll drive
Be ready to decide (these change the code — see `LEGAL-BRIEF.md §6`):
- Entity model: **own 501(c)(3)** vs **partner charity** vs **fiscal sponsor**.
- Token transferability (keep transferable vs. make non-transferable).
- DEX liquidity: keep / delay / drop.
- KYC/AML gating and contribution caps.

## Step 5 — Feed results back to code (Stage "Compliance")
Apply required changes **before** the audit freeze if possible — that's why legal goes
**before** audit. If legal lands after audit and changes code, you re-audit the diff.

### Red flags when choosing counsel
- Only crypto, no nonprofit experience (or vice versa). - Won't put a Howey view in
  writing. - Vague on charitable-solicitation registration. - No conflicts check.

---

## The recommended order (your decision, my recommendation)

**Legal first, then audit.** A legal opinion can change the contracts (transferability,
liquidity, KYC). Auditing first risks paying twice. Do Stage 3 → apply changes → freeze →
Stage 2.

## Tracking
Keep a simple log: firm · contacted date · quote · timeline · decision. Template:

| Firm | Type | Contacted | Quote | Timeline | Status |
|---|---|---|---|---|---|
| | audit/legal | | | | |
