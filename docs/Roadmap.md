# BITESHA — Roadmap

Sequenced so that **no public fundraising happens before audit + legal review**.

---

## Phase 0 — Foundation (DONE)
- [x] Smart contracts implemented (token, charity, treasury, governance, vesting)
- [x] Internal security pass — all Critical/High/Medium/Low findings fixed
- [x] 165 tests, 100% line coverage on production contracts
- [x] Randomized invariant fuzzing (food ≥ 80%, conservation, solvency)
- [x] Pure donation model — profit mechanics removed
- [x] Transparency system (dashboard, signed monthly reports, on-chain anchoring)
- [x] Document package (this set) for auditors and counsel

## Phase 1 — Independent audit
- [ ] Select auditor (Trail of Bits / OpenZeppelin / CertiK / Halborn / Nethermind)
- [ ] Code freeze; pin commit; hand over [AUDIT-SCOPE.md](./AUDIT-SCOPE.md)
- [ ] Audit → remediate findings → re-review → publish final report
- [ ] Slither + Mythril clean of High/Critical

## Phase 2 — Legal review
- [ ] Engage US firm covering crypto + DAO + nonprofit law
- [ ] Hand over [LEGAL-BRIEF.md](./LEGAL-BRIEF.md) + this package
- [ ] Securities analysis of BTSH; charitable-solicitation; MSB; tax; DAO

## Phase 3 — Charitable structure
- [ ] Decide model: own 501(c)(3) vs. partner charity vs. fiscal sponsor
- [ ] Register with NY AG Charities Bureau (and other states as advised)
- [ ] Establish food-distribution operations + NYC DOHMH permits

## Phase 4 — Regulatory review
- [ ] Securities risk sign-off; AML/KYC determination
- [ ] Charitable-solicitation compliance; tax positions; DAO operating rules

## Phase 5 — Compliance implementation
- [ ] Apply counsel's required code changes (if any — e.g. transfer restrictions, caps)
- [ ] Finalize Whitepaper, website, marketing language
- [ ] Finalize Terms of Use, Privacy Policy, AML/KYC policy

## Phase 6 — Testnet & operations dry-run
- [ ] Deploy to Base Sepolia; multi-day live integration test
- [ ] Gnosis Safe multisig (incl. independent reps) configured
- [ ] Public dashboard live against testnet
- [ ] First mock monthly report generated, signed, anchored, and verified

## Phase 7 — Public launch
- [ ] Mainnet deploy (Base); verify role renounce complete
- [ ] Open contributions; begin food distribution
- [ ] First real signed monthly report anchored on-chain

## Ongoing — Trust commitments
- [ ] Annual independent **financial** audit of charity fund movement
- [ ] Monthly signed transparency reports
- [ ] Periodic re-audit on any contract change

> Order is the point: audit and legal precede any acceptance of public funds.
