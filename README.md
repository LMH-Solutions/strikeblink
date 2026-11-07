# StrikeBlink

**MLH Solana Hackathon · November 6–8, 2026 · devnet only**

Share a Solana Action link for a short-dated SOL prediction market. A Blink client displays live odds and offers YES/NO buys; StrikeBlink returns an **unsigned** transaction for the user's devnet wallet to review and sign. Test tokens have no real value.

## Run

Node.js 20+ (tested with Node 24). No wallet file, private key, paid service, or signing provider is needed.

```sh
npm ci
npm run build
npm start
# http://localhost:8787
```

Optional shell environment variables:

```sh
PORT=8787 PUBLIC_BASE_URL=https://your-public-host.example npm start
# RPC_URL may point to another DEVNET RPC; the full genesis hash is checked.
```

Use `PUBLIC_BASE_URL` behind a reverse proxy so metadata contains the correct public HTTPS origin. Do not commit credential-bearing RPC URLs. A stable public HTTPS deployment is still outstanding; localhost is not a public demo link. Hosts should run `npm ci && npm run build`, then `npm start` with their assigned `PORT`. No deployment or paid resource was provisioned.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /` | Responsive market browser, Blink links, unsigned-transaction diagnostic form |
| `GET /actions.json` | Solana Actions discovery rules |
| `GET /api/markets` | Open, seeded SOL markets of at most 24 hours, with mUSDC collateral |
| `GET /api/actions/trade?market=<ID-or-PDA>` | Action metadata, odds, countdown, YES/NO buttons |
| `POST /api/actions/trade?market=<ID-or-PDA>&side=yes&amount=5` | Unsigned buy; JSON body `{"account":"<devnet-public-key>"}` |
| `OPTIONS /api/actions/trade` | CORS preflight |
| `GET /icon.svg` | Static Action icon |
| `GET /health` | Process health (not a live RPC probe) |

Omitting `market` selects the soonest-ending liquid SOL market. Amounts are 1–1000 mUSDC with at most six decimal places; both `yes` and `no` are supported. Expired, resolved, unseeded, and <30-second-to-expiry markets cannot be bought. If no market is open the card is disabled, never populated with fictional odds.

```sh
curl http://localhost:8787/api/markets
curl 'http://localhost:8787/api/actions/trade?market=<ID-or-PDA>'
curl -X POST 'http://localhost:8787/api/actions/trade?market=<ID-or-PDA>&side=yes&amount=5' \
  -H 'Content-Type: application/json' \
  -d '{"account":"<YOUR_DEVNET_PUBLIC_KEY>"}'
```

Response: `{ "type": "transaction", "transaction": "<base64 unsigned legacy transaction>", "message": "..." }`. Building is not a trade execution or confirmation. Rebuild if the blockhash expires.

After public hosting, open:

```text
https://dial.to/?action=solana-action%3Ahttps%3A%2F%2FYOUR_HOST%2Fapi%2Factions%2Ftrade&cluster=devnet
```

The home page builds market-specific inspector links automatically. Dial.to rendering and actual devnet wallet signing have not yet been verified. Use a separate test wallet, never a personal/mainnet wallet. Test funds are available from PREDICT's devnet reference app; the server does not request funds or manage wallets.

## Safety and implementation

- Hono + strict TypeScript; esbuild emits **CommonJS**, so Node uses the SDK's CJS exports and avoids the Anchor `BN` raw-ESM import problem.
- `PmAmmClient.readOnly` plus `ix.swap` only. No `send.*`, signing, broadcast, secret key, or custodial wallet code.
- Devnet program `GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y`; fixed collateral `3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ` (mUSDC, 6 decimals). The program also exists on mainnet, so the full devnet genesis hash is verified before reads/builds.
- Published pm-AMM helper rescales reserves to the current accrual time and includes the **2% buy fee**. A **1% slippage** floor is encoded in every swap.
- Compute budget plus idempotent mUSDC, YES, and NO token-account creates precede the swap. Both outcome accounts are required regardless of direction. Devnet SOL covers fees and account rent when the user signs.
- List reads cache/coalesce for 15 seconds; RPC calls have a 15-second timeout and no automatic rate-limit retries. Requests are capped at 4 KiB, public errors hide provider details, and market labels are HTML-escaped.
- SOL market names are labels, not authenticated strike feeds. Resolution is **creator-controlled**, not guaranteed by an oracle. This server does not create or resolve markets, implement claim chaining, or verify settlement prices.

## Tests and verification

```sh
npm test              # build + 14 offline tests; no network or funds
npm run test:live     # read-only devnet discovery and real unsigned YES/NO builds
npm run test:local    # HTTP smoke against a RUNNING server
# BASE_URL=https://your-host.example npm run test:local
```

Verified November 7, 2026, approximately 9:13 AM EST:

```text
npm test: tests 14, pass 14, fail 0
OK /actions.json
OK /health
OK /api/markets (2 open SOL markets)
OK /api/actions/trade
OK live YES unsigned transaction (5 instructions, no signatures)
OK live NO unsigned transaction (5 instructions, no signatures)
```

Offline fixtures test actual SDK instructions, exact amount parsing, buy fees, slippage, compute budget, all three ATAs, absent signatures, CORS, wrong-cluster rejection, wrong collateral, disabled/empty markets, safe errors and HTML escaping. Live tests deliberately fail if no usable market exists; an error response never counts as a successful swap.

No on-chain trade, wallet signature, transaction simulation, Blink unfurl, payout, or post-resolution claim has been demonstrated in these tests. A pure-JS bigint fallback warning is expected. `npm audit` reports 14 transitive findings (8 moderate, 6 high) in the Solana/Anchor dependency tree; no forced breaking upgrades were applied. This is a devnet hackathon prototype, not production/mainnet software.

## Originality and AI disclosure

Created for the **MLH Solana Hackathon** during its November 6–8, 2026 hacking period. Grok Bot assisted implementation, tests, debugging and documentation. The idea and planning predate kickoff; no StrikeBook code or other prior own project materials are included in this entry. PREDICT's public pm-AMM program, published SDK and helper are third-party dependencies. Some displayed devnet markets are created by the separate StrikeBook keeper; StrikeBook is not part of this submission. See [THIRD_PARTY.md](THIRD_PARTY.md) for the copied helper's MIT notice.

Submission draft: [mlh/SUBMISSION.md](mlh/SUBMISSION.md). Demo script: [mlh/DEMO-SCRIPT.md](mlh/DEMO-SCRIPT.md). Status: [PROGRESS.md](PROGRESS.md).

MIT license. Not financial advice. No real-money trading.
