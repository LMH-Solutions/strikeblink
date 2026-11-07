# StrikeBlink demo — target 1:50, hard limit 2:00

Record during November 6–8, 2026. Say the hackathon name at the very beginning. No invented transactions, confirmation, wallet popups or oracle claims. Do not show secrets, terminal environment variables or private files.

| Time | Screen | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | StrikeBlink title + devnet badge | “This is StrikeBlink for the MLH Solana Hackathon: short-dated SOL prediction markets shared as Solana Actions.” |
| 0:10–0:25 | Responsive home page, open SOL cards | “Instead of navigating a full trading dashboard, a shared link can offer YES or NO. These odds come from real PREDICT pm-AMM markets on Solana devnet. Test tokens have no value.” |
| 0:25–0:45 | Open a card's Action metadata; show preset and custom links | “The GET endpoint exposes the market, current odds, countdown and buy choices. It disables closed or empty markets instead of pretending they are tradeable.” |
| 0:45–1:10 | Enter a disposable devnet PUBLIC key and market in diagnostic form; preview YES, then NO | “The POST endpoint builds an unsigned transaction for the user's wallet. Both directions work. The quote includes the two-percent fee and a one-percent slippage minimum. This preview does not execute a trade.” |
| 1:10–1:30 | Test output plus decoded transaction instruction count | “The transaction has compute budget, mUSDC and both outcome token-account creates, and the swap instruction. It has no signatures. Fourteen tests pass, plus live read-only devnet builds for YES and NO.” |
| 1:30–1:45 | Code snippets: readOnly, genesis guard, ix.swap | “Hono and TypeScript serve the Action; CommonJS avoids the Anchor BN import issue. The server never holds keys or signs or sends. Outcomes are resolved by market creators, not an oracle in this app.” |
| 1:45–1:50 | Repo link, MLH name and AI disclosure | “Built this weekend with Grok Bot assistance, with no StrikeBook code reused. Source and limitations are public.” |

## Optional substitution only after verification

If a public HTTPS deployment and disposable devnet wallet are ready, replace the 0:25–1:10 section with a real dial.to card and a wallet-reviewed YES buy, followed by a real explorer confirmation. Only say “confirmed” after actually observing confirmation. Keep the full video under two minutes. If those steps remain blocked, show the verified unsigned workflow and disclose the limitation; do not manufacture evidence.

## Capture checklist

- Start server (`npm ci && npm run build && npm start`) and rerun `npm run test:local`.
- Use the current open market; hardcoded market IDs expire. Do not display stale odds as current.
- Capture 1280x720 or 1920x1080; hide browser personal data. Fit mobile view to demonstrate the responsive layout briefly.
- Record genuine UI/terminal footage with narration; this file is a script, not a recorded demo.
- Upload/attach video only through an authorized account workflow. Lee owns the final MLH submission clicks.
