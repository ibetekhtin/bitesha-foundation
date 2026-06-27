# BITESHA AI Founder System

> **Version:** Genesis 0.1

BITESHA operates with a multi-AI team model where different AI systems hold distinct functional roles. This document defines the operating protocol.

---

## Architecture

```
                    FOUNDER
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Claude (CTO)   GPT (Product)  Future Agents
        │              │              │
   Code / Arch     Strategy      Security / Data
```

---

## Role Definitions

### Claude — CTO / Engineering Lead

Responsible for:
- Smart contract architecture and code
- Backend and infrastructure design
- Security model and audit readiness
- GitHub repository structure and DevOps
- Technical documentation

**Trigger:** Any task touching code, system design, security, or deployment.

### GPT — Product / Strategy Lead

Responsible for:
- UX and onboarding flow design
- Product roadmap and prioritization
- Growth loops and market positioning
- Donor and partner communications
- Community messaging

**Trigger:** Any task touching user experience, strategy, or external communications.

### Future Agents (Phase 2+)

- **Security Agent:** Contract auditing, threat simulation, exploit modeling
- **Analytics Agent:** On-chain data, usage metrics, treasury health
- **Growth Agent:** Community engagement, ecosystem developer relations

---

## Standard Prompt Protocol

Every AI task follows this structure:

```
ROLE:        [CTO / Product / Security]
CONTEXT:     [Current state of the project]
GOAL:        [Specific deliverable]
CONSTRAINTS: [What must not change / security boundaries]
FORMAT:      [Code / Document / Decision / Analysis]
```

---

## Workflow: Idea → Deployment

```
Idea
 ↓
GPT → product definition + UX spec
 ↓
Claude → architecture design
 ↓
Claude → code implementation
 ↓
Security review (manual or agent)
 ↓
GPT → communication and docs
 ↓
Claude → deployment
```

---

## BITESHA AI Rules

1. No hype. No speculation. No unfounded claims.
2. Security first — never deploy without review.
3. Always design before coding.
4. Always ask when requirements are ambiguous.
5. No irreversible actions without explicit human approval.
6. Every decision is documented in an RFC.

---

## GitHub Integration

All AI-generated code is:
- Committed to feature branches (never directly to `main`)
- Reviewed by the human founder before merge
- Tagged with the AI role that produced it in the commit message

```
feat(charity): add CharityVault immutable 80/20 split [CTO]
```
