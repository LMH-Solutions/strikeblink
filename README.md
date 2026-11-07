# StrikeBlink

One-click **Solana Actions / Blinks** for short-dated strike prediction markets on [PREDICT's public pm-AMM](https://predict-pm-amm.dev) (**devnet only**).

**MLH Solana Hackathon** entry — hacking Fri Nov 6 12:00 PM ET → Sun Nov 8 11:45 AM ET (final submit).

Paste a Blink link anywhere (X, Discord, chat) → wallet card unfurls with live YES/NO odds → one tap builds an unsigned swap on pm-AMM → you sign.

## Quick start

```bash
npm install
npm start
# → http://localhost:8787
```

Node **≥ 20**. CommonJS on purpose (`require`) so `@pm-amm/sdk` + `@anchor-lang/core` work under raw Node.

### Endpoints

| Path | What |
| --- | --- |
| `GET /actions.json` | Actions discovery map (`/*` → `/api/actions/*`) |
| `GET /api/actions/trade` | Action metadata (buttons Buy YES 5 / Buy NO 5 / custom) |
| `POST /api/actions/trade?market=&side=yes\|no&amount=` | Unsigned base64 swap tx for `{ "account": "<pubkey>" }` |
| `GET /api/markets` | Open unresolved markets from `fetchAllMarkets(443)` |
| `GET /` | Mobile fallback HTML with dial.to inspector links |

### Test with dial.to

```
https://dial.to/?action=solana-action:<URL-ENCODED https://YOUR_HOST/api/actions/trade>
```

Example (after deploy):

```
https://dial.to/?action=solana-action%3Ahttps%3A%2F%2FYOUR_HOST%2Fapi%2Factions%2Ftrade
```

Use a **devnet** wallet (Phantom → Developer Settings → Testnet Mode → Solana Devnet). Fund mUSDC:

```bash
curl -X POST https://pm-amm-devnet.vercel.app/api/faucet \
  -H 'content-type: application/json' \
  -d '{"wallet":"<YOUR_DEVNET_PUBKEY>"}'
```

### Env

| Var | Default |
| --- | --- |
| `PORT` | `8787` |
| `RPC_URL` | `https://api.devnet.solana.com` |
| `PUBLIC_BASE_URL` | derived from request (set this behind a tunnel/proxy) |

## Devnet constants

- Program: `GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y`
- mUSDC: `3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ`
- Docs: [Solana Actions](https://solana.com/docs/tools/actions) · [pm-AMM llms.txt](https://predict-pm-amm.dev/llms.txt)

## MLH disclosure

- **All feature code written during the event** (Nov 6–8 2026).
- **AI:** Grok Bot assisted with code generation and docs.
- **Third-party:** `@pm-amm/sdk`, `@solana/actions`, `@solana/web3.js`, `@anchor-lang/core`, `@solana/spl-token`, Express; quote helper adapted from [predict-pm-amm.dev/helpers/pm-amm-helpers.ts](https://predict-pm-amm.dev/helpers/pm-amm-helpers.ts).
- **No StrikeBook code reused.** [StrikeBook](https://github.com/LMH-Solutions/strikebook) is a separate prior project (Dec 5 Perps entry). StrikeBlink may trade markets that happen to exist on the public pm-AMM, including ones a keeper created.
- Idea (Blinks for strike markets) predates the event (MLH rule 7 allows ideas).

## License

MIT © 2026 LMH-Solutions
