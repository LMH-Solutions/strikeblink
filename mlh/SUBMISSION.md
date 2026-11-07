# MLH Challenges submission draft — StrikeBlink

Verified November 7, 2026, approximately 9:14 AM EST (America/New_York):
- Event: https://events.mlh.com/events/15200-solana-hackathon
- MLH Challenges landing: https://www.mlh.com/events/solana-hackathon
- Exact public submit link: https://www.mlh.com/events/solana-hackathon/submissions/new (linked on the landing page; redirects unauthenticated visitors to Sign In).
- Schedule: **initial Sunday Nov 8, 10:00 AM EST; final Sunday Nov 8, 11:45 AM EST**. Landing page says submissions close 1:00 PM EST; follow the earlier schedule deadlines, not that later close.
- Public prizes now list Top 3 Overall ($1,000 microgrant per team) and DeFi Track ($100 digital gift card per winning team member). No payout is guaranteed. DeFi is the relevant optional category; AI-assisted coding alone does not qualify as an AI product.

## Ready-to-paste fields (accurate to current build)

**Project name:** StrikeBlink

**Tagline:** Share a SOL prediction-market trade as a Solana Blink—YES or NO, devnet only.

**Inspiration:** Prediction markets usually require navigating a full dashboard. We wanted a small, shareable Action endpoint that turns an existing on-chain SOL market into a wallet-reviewable YES/NO transaction.

**What it does:** StrikeBlink discovers liquid, open SOL prediction markets of at most 24 hours on PREDICT's devnet pm-AMM. A Solana Action card presents live odds, a countdown, and preset/custom YES and NO buys. Its POST endpoint returns an unsigned transaction with compute budget, required token-account setup, a fee-aware quote and a 1% slippage minimum. A responsive market browser links to Blink clients and offers an unsigned-buy diagnostic form. The service never signs or sends transactions and never holds user keys.

**How we built it:** Hono and strict TypeScript on Node.js, esbuild CommonJS output, Solana Actions response formats/CORS and the published @pm-amm/sdk read-only client and instruction builders. We use the published pm-AMM helper for accrual-aware, 2%-fee-inclusive quotes. The server checks the full devnet genesis hash and pins the mUSDC collateral. Grok Bot assisted coding, testing, debugging and documentation.

**Challenges:** Raw Node ESM/Anchor BN compatibility; unsigned swaps needing both YES and NO associated token accounts even for a one-sided buy; distinguishing an initialized but unseeded market from a tradeable pool; and using full genesis hashes for RPC verification while Action headers use the first 32 characters.

**Accomplishments:** Fourteen offline tests pass, including actual SDK YES/NO instruction composition, zero transaction signatures, compute budget and ATA coverage, fee/slippage protections, input validation, closed-market behavior, cluster/mint checks, safe errors and CORS. Read-only live devnet smoke checks found two liquid SOL markets and built both YES and NO transactions, five instructions each. These are unsigned builds, not executed trades.

**What we learned:** Solana Actions separate metadata, transaction construction and user consent. A correct unsigned transaction must include setup instructions that signing convenience helpers normally hide. pm-AMM reserves need time-accrual adjustment before quoting.

**What's next:** Stable HTTPS hosting, a recorded wallet-reviewed devnet trade, Blink rendering checks, richer card images and a separately reviewed resolved-position/claim Action. No mainnet or real-money rollout is claimed.

**Built with:** TypeScript, Node.js, Hono, esbuild, Solana, Solana Actions, Blinks, @pm-amm/sdk, @solana/web3.js, @solana/spl-token, @anchor-lang/core, Grok Bot (AI assistance).

**Code:** https://github.com/LMH-Solutions/strikeblink

**Working demo URL:** NOT YET AVAILABLE — deploy public HTTPS before claiming a live app.

**Video URL/upload:** NOT YET AVAILABLE — record and attach a <=2-minute video using DEMO-SCRIPT.md. Do not paste the repository as a video/demo substitute.

**Originality / prior work / AI disclosure:** StrikeBlink code was written during the Nov 6–8, 2026 MLH Solana Hackathon. The idea and planning predate kickoff. No code or other prior own project materials from StrikeBook are included. It reads PREDICT's public devnet pm-AMM; some markets may be created by the separate StrikeBook keeper, which is not part of this submission. Third-party open-source SDK/helper use is disclosed in THIRD_PARTY.md. Grok Bot assisted implementation, tests and docs. This entry is not to be submitted to another hackathon.

**Limitations:** Devnet only; no real value. Creator-controlled resolution, not a verified price oracle. Static icon; no Pyth resolver, claim chaining, browser wallet adapter, or dynamic odds image. Actual wallet signing, confirmation, and dial.to rendering remain unverified. Solana/Anchor transitive dependency audit findings remain (14 total). No claim of production readiness, executed trading volume or revenue.

## What Lee must click (nothing submitted yet)

1. Open https://www.mlh.com/events/solana-hackathon/submissions/new and sign in with the registered MLH account (lee@lmhsolutions.co). Complete account/registration requirements himself.
2. Create the StrikeBlink submission, paste the accurate fields above, provide code and actual demo/video links, identify the team, and select the DeFi category if the form offers it. Review any eligibility, AI-use and originality attestations himself.
3. Click the form's submit control for the **initial entry before Nov 8, 10:00 AM EST**. The exact authenticated button text is unverified; the form is behind sign-in.
4. Reopen/edit that same entry with final links/video and click its final update/submit control **before Nov 8, 11:45 AM EST**. Keep the confirmation/receipt. Never create duplicate entries.

Do not claim the entry is ready or submitted until the hosting/video gaps are closed and Lee has the platform confirmation. No account login, submission, upload or external message was performed by this build task.
