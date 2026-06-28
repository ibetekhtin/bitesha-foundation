# BITESHA — Website

A single-file, dependency-free landing site (`index.html`) for the BITESHA charity
project. Built to be portfolio-ready and to slot in front of the existing
`dashboard/` and `docs/`.

## What it shows
- The mission and the immutable 80/20 split
- How it works (contribute → split → buy food → receipt+vote → signed reports)
- A transparency section that can read **live** numbers from the deployed `CharityVault`
- The honest on-chain / off-chain boundary
- Token model (donation + governance, no profit mechanics) and distribution
- Tech/security highlights, roadmap, and links to the full document package

## Run locally
Just open the file:
```bash
open website/index.html
```
No build step, no dependencies (ethers loads from CDN only for the optional live stats).

## Activate live stats (after deployment)
In `index.html`, set:
```js
const VAULT_ADDRESS = "0x...";              // deployed CharityVault
const RPC_URL = "https://mainnet.base.org"; // or your RPC
```
Until then, the section gracefully shows placeholders and points to the dashboard tool.

## Publish (GitHub Pages — recommended for portfolio)
1. Push the repo (already done).
2. GitHub → repo **Settings → Pages**.
3. Source: **Deploy from a branch** → branch `main` → folder `/ (root)`.
4. Your site will be at:
   `https://ibetekhtin.github.io/bitesha-foundation/website/`
   and the dashboard at `.../bitesha-foundation/dashboard/`.

> Doc links point to the GitHub-rendered Markdown so they look right regardless of host.

## Add to your portfolio
Link to the published Pages URL (or the repo). Suggested blurb:

> **BITESHA** — a transparent crypto charity feeding people in NYC. Designed the full
> system: 11 Solidity contracts (immutable 80/20 donation split, DAO governance,
> on-chain transparency registry), 165 tests at 100% line coverage with invariant
> fuzzing, a live on-chain dashboard, and the complete document package for audit and
> legal review.

## Disclaimer
Informational only. BTSH is not an investment; the project will not solicit public funds
until independent audit and legal review are complete.
