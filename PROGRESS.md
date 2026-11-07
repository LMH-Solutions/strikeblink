# StrikeBlink progress

All timestamps America/New_York (EST). Entry: MLH Solana Hackathon, Nov 6–8, 2026.

## Nov 7, 2026 · 9:13 AM EST
- Lee explicitly requested a local box build and push. Cloned the named repository; found existing weekend commit `2d4d720` (9:03 AM EST), not just the README baseline. Preserved history and used no StrikeBook source.
- Migrated fresh StrikeBlink implementation to strict TypeScript + Hono. esbuild emits CommonJS to avoid Anchor/BN raw-ESM failures.
- Added devnet genesis verification, fixed mUSDC collateral, short-dated SOL market filtering, 15-second list cache, no-liquidity exclusion, fee-aware quotes from the published third-party helper, bounded amounts, invalid wallet handling, safe errors, compute budget, three idempotent ATAs, unsigned swap transactions only.
- Mobile market browser and diagnostic unsigned-buy preview. Wallet signing uses an external Blink client; no browser wallet adapter, claim chaining, Pyth resolver, or dynamic odds image is implemented.
- Verified live docs: predict-pm-amm.dev/hackathon.md, llms.txt, MLH event schedule, and MLH Challenges landing page in this turn. Event schedule says initial Nov 8 10:00 AM EST / final 11:45 AM EST. Challenges landing says closes 1:00 PM EST; use the earlier schedule deadlines.
- `npm test`: 12 passing, 0 failing, including real SDK YES/NO instructions serialized against offline fixtures, no signatures, CU and both outcome ATAs.
- `npm run test:live`: passed discovery, health, market list (2 liquid open SOL markets), Action metadata, live YES unsigned build and live NO unsigned build (5 instructions each, zero signatures). Read-only RPC; no transaction broadcast, signing, faucet request, or money spent.
- Tests first exposed an unseeded SOL market being selected; excluded zero-liquidity markets before final passing live run. Genesis checks compare the full hash; Action chain ID uses the first 32 characters.
- npm reports 14 transitive vulnerabilities (8 moderate, 6 high) in the Solana/Anchor dependency tree. No forced major upgrades or claim of production readiness. Pure-JS bigint fallback warning is benign for these passing tests.

## Remaining work
- Stable public HTTPS hosting and a public demo URL are NOT established.
- Actual devnet wallet signing/confirmation and dial.to rendering are NOT verified. The passing smoke tests prove unsigned build paths, not executed trades.
- Record and upload a truthful <=2-minute demo during the weekend. Script and submission draft are in `mlh/`.
- Lee must sign in to MLH Challenges and do the final initial/final submission clicks; nothing submitted here.

## Nov 7, 2026 · 9:15 AM EST
- Pushed implementation commit `121b3dc` and dedicated smoke/offline test commit `62a3b48` to main. Final offline suite now 14 passing / 0 failing, including actual genesis-guard rejection and unseeded-market regression.
- Added truthful MLH Challenges submission fields and a 1:50 demo script; copied them to `/workspace/crypto-acquisition/solana-perps/mlh/` for the bounty coordinator. Removed unimplemented Pyth/claim/wallet-adapter claims from the old draft.
- Verified the landing page links to `/events/solana-hackathon/submissions/new`; opening that exact route displays Sign In. Did not log in or submit. Public prize tracks now show a $1,000 Top 3 microgrant and $100/member DeFi gift-card track; no revenue booked.
- Repository-local git author identity uses the account's public GitHub noreply address. No credentials were read or printed.
