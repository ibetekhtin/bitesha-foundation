# BITESHA — AML / KYC Policy

> **DRAFT — NOT LEGALLY REVIEWED, and CONDITIONAL.** Whether AML/KYC obligations apply
> to BITESHA is a legal question for counsel (see [LEGAL-BRIEF.md](./LEGAL-BRIEF.md) §5).
> This draft is a starting point **in case** counsel determines such a program is
> required. Do not treat its applicability as settled. Bracketed `[…]` items need
> legal/compliance input. Do not publish as-is.

**Last updated:** [DATE] · **Version:** 0.1-draft

---

## 1. Purpose

To prevent the Services from being used for money laundering, terrorist financing, or
sanctions evasion, and to comply with any applicable anti-money-laundering (AML) and
know-your-customer (KYC) obligations **if** counsel determines they apply.

## 2. Applicability (to be determined by counsel)

Open questions that decide whether this policy is needed:
- Does accepting USDC and converting to USD to buy food make BITESHA (or a partner) a
  **money services business** (FinCEN) or a **money transmitter** (NY)?
- Does the charitable structure or use of a regulated third party for crypto→fiat change
  the analysis?
- What contribution thresholds, if any, trigger identity verification?

Until counsel advises, treat this as a contingency plan, not active policy.

## 3. Risk-based approach (if implemented)

- **Tiered verification:** small contributions may require no KYC; contributions above
  `[threshold]` may require identity verification. [Thresholds set by counsel.]
- **Sanctions screening:** screen contributor wallet addresses and (where collected)
  identities against [OFAC SDN and relevant sanctions lists].
- **Geographic restrictions:** block prohibited jurisdictions. [List per counsel.]

## 4. Customer due diligence (if implemented)

- Collect and verify [name, DOB, address, government ID] via a third-party KYC provider.
- Enhanced due diligence for higher-risk or higher-value contributions.
- Records retained for [retention period] per applicable law.

## 5. Monitoring & reporting

- Monitor for suspicious patterns (structuring, sanctioned addresses, anomalous flows).
- File [SARs / required reports] with the appropriate authority where legally required.
- Designate a [compliance officer] responsible for the program.

## 6. On-chain transparency aids monitoring

Because contributions and spends are recorded on a public blockchain, fund flows are
inherently traceable, which supports monitoring — but this does **not** by itself satisfy
any KYC obligation that may apply to identifying contributors.

## 7. Technical levers available

If counsel requires controls, the contracts/front-end can support:
- Contribution caps and per-address limits.
- Allowlist / KYC-gated contribution (only verified addresses may contribute).
- Geo-blocking at the website layer.
- Sanctions-list screening before accepting a contribution.

## 8. Review

This policy (if adopted) will be reviewed [annually] and upon material regulatory change.

## 9. Contact

[Compliance contact.]

---

> Reminder: applicability and contents are for counsel to determine. Nothing herein is
> legal advice.
