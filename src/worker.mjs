/**
 * Cloudflare Workers entry for StrikeBlink (nodejs_compat).
 * Written during MLH Solana Hackathon — no StrikeBook code.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  PublicKey,
  Connection,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PmAmmClient, CU } from "@pm-amm/sdk";
import { marketState, quoteSwap, minOutput } from "./helpers/pm-amm-helpers.mjs";
import seed from "./market-seed.json";

const PROGRAM_ID = new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ");
/** Public Solana RPC blocks Cloudflare Worker egress; use light public alts + seed PDAs. */
const RPC_CANDIDATES = [
  "https://devnet.rpcpool.com",
  "https://solana-devnet.gateway.tatum.io",
  "https://solana-devnet.api.onfinality.io/public",
  "https://api.devnet.solana.com",
];
const REF_APP = "https://pm-amm-devnet.vercel.app";
const FAUCET_URL = "https://pm-amm-devnet.vercel.app/api/faucet";
const DEFAULT_AMOUNT_USDC = 5;
const DEFAULT_SLIPPAGE_BPS = 100;
const CACHE_TTL_MS = 60_000;

/** @type {{ rpc?: string, markets?: any[], at?: number }} */
const cache = globalThis.__strikeblinkCache || (globalThis.__strikeblinkCache = {});

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Content-Encoding", "Accept-Encoding"],
  }),
);

app.use("*", async (c, next) => {
  c.header("X-Action-Version", "2.4");
  c.header("X-Blockchain-Ids", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
  await next();
});

function pickRpc() {
  return cache.rpc || RPC_CANDIDATES[0];
}

function getClient(rpc = pickRpc()) {
  const connection = new Connection(rpc, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  return { connection, client: PmAmmClient.readOnly(connection, PROGRAM_ID, USDC_MINT), rpc };
}

async function withRpc(fn) {
  let lastErr;
  const order = cache.rpc
    ? [cache.rpc, ...RPC_CANDIDATES.filter((r) => r !== cache.rpc)]
    : [...RPC_CANDIDATES];
  for (const rpc of order) {
    try {
      const ctx = getClient(rpc);
      const result = await fn(ctx);
      cache.rpc = rpc;
      return result;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (/403|429|Too Many|blocked|rate/i.test(msg)) continue;
      throw e;
    }
  }
  throw lastErr;
}

function seedPdas() {
  const now = Math.floor(Date.now() / 1000);
  return (seed.markets || [])
    .filter((m) => !m.endTs || m.endTs > now - 3600)
    .map((m) => m.pda);
}

function decodeName(nameField) {
  if (!nameField) return "";
  if (typeof nameField === "string") return nameField.trim();
  const bytes = Array.isArray(nameField) ? Uint8Array.from(nameField) : nameField;
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return Buffer.from(bytes.subarray(0, end)).toString("utf8").trim();
}

function bnToSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") {
    return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  }
  if (typeof v.toString === "function") {
    const s = v.toString(10);
    if (/^\d+$/.test(s) && Number(s) <= Number.MAX_SAFE_INTEGER) return Number(s);
    return s;
  }
  return Number(v);
}

function bnSecs(v) {
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") {
    try {
      return v.toNumber();
    } catch {
      return Number(v.toString(10));
    }
  }
  return Number(v?.toString?.(10) ?? v);
}

function formatPct(p) {
  return `${(p * 100).toFixed(1)}%`;
}

function formatCountdown(secs) {
  if (secs <= 0) return "ended";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function baseUrl(c) {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

async function listOpenMarkets(limit = 8) {
  if (cache.markets && cache.at && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.markets.slice(0, limit);
  }

  const pdas = seedPdas().map((p) => new PublicKey(p));
  const now = Math.floor(Date.now() / 1000);
  const open = await withRpc(async ({ client }) => {
    const ns = client.program.account;
    const accounts = await ns.market.fetchMultiple(pdas);
    const rows = [];
    for (let i = 0; i < pdas.length; i++) {
      const m = accounts[i];
      if (!m) continue;
      try {
        const endTs = bnSecs(m.endTs);
        if (m.resolved || !(endTs > now)) continue;
        const state = marketState(m, now);
        const id = bnToSafe(m.marketId);
        rows.push({
          id,
          pda: pdas[i].toBase58(),
          name: decodeName(m.name) || `Market #${id}`,
          yesPrice: state.price,
          noPrice: 1 - state.price,
          endTs,
          secondsLeft: state.secondsLeft,
          appUrl: `${REF_APP}/market/${id}`,
        });
      } catch {
        /* skip */
      }
    }
    rows.sort((a, b) => a.endTs - b.endTs);
    return rows;
  });

  cache.markets = open;
  cache.at = Date.now();
  return open.slice(0, limit);
}

async function resolveMarket(marketParam) {
  if (!marketParam) {
    const open = await listOpenMarkets(1);
    if (!open.length) return null;
    return withRpc(async ({ client }) => {
      const pda = new PublicKey(open[0].pda);
      const account = await client.fetchMarket(pda);
      return account ? { pda, account, id: open[0].id, meta: open[0] } : null;
    });
  }
  if (/^\d+$/.test(String(marketParam))) {
    const raw = String(marketParam);
    const idForPda = BigInt(raw);
    const idDisplay = idForPda <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(idForPda) : raw;
    return withRpc(async ({ client }) => {
      const pda = client.marketPda(idForPda);
      const account = await client.fetchMarket(pda);
      if (!account) return null;
      const state = marketState(account);
      return {
        pda,
        account,
        id: idDisplay,
        meta: {
          id: idDisplay,
          pda: pda.toBase58(),
          name: decodeName(account.name) || `Market #${idDisplay}`,
          yesPrice: state.price,
          noPrice: 1 - state.price,
          endTs: bnSecs(account.endTs),
          secondsLeft: state.secondsLeft,
          appUrl: `${REF_APP}/market/${idDisplay}`,
        },
      };
    });
  }
  let pda;
  try {
    pda = new PublicKey(marketParam);
  } catch {
    return null;
  }
  return withRpc(async ({ client }) => {
    const account = await client.fetchMarket(pda);
    if (!account) return null;
    const id = bnToSafe(account.marketId);
    const state = marketState(account);
    return {
      pda,
      account,
      id,
      meta: {
        id,
        pda: pda.toBase58(),
        name: decodeName(account.name) || `Market #${id}`,
        yesPrice: state.price,
        noPrice: 1 - state.price,
        endTs: bnSecs(account.endTs),
        secondsLeft: state.secondsLeft,
        appUrl: `${REF_APP}/market/${id}`,
      },
    };
  });
}

async function buildUnsignedSwapTx({ account, marketPda, marketAccount, side, amountUsdc }) {
  const signer = new PublicKey(account);
  const state = marketState(marketAccount);
  if (state.resolved || state.expired) {
    const err = new Error("This market is resolved or expired — no more swaps.");
    err.code = "MARKET_CLOSED";
    throw err;
  }
  const amountInMicro = Math.round(Number(amountUsdc) * 1_000_000);
  if (!Number.isFinite(amountInMicro) || amountInMicro <= 0) {
    const err = new Error("amount must be a positive number of mUSDC");
    err.code = "BAD_AMOUNT";
    throw err;
  }
  const direction = side === "no" ? "usdcToNo" : "usdcToYes";
  const q = quoteSwap(marketAccount, direction, amountInMicro);
  const minOut = minOutput(q, DEFAULT_SLIPPAGE_BPS);
  return withRpc(async ({ client, connection }) => {
    const yesMint = client.yesMint(marketPda);
    const noMint = client.noMint(marketPda);
    const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, signer);
    const yesAta = getAssociatedTokenAddressSync(yesMint, signer);
    const noAta = getAssociatedTokenAddressSync(noMint, signer);
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: CU.HEAVY })];
    for (const [mint, ata] of [
      [USDC_MINT, usdcAta],
      [yesMint, yesAta],
      [noMint, noAta],
    ]) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          signer,
          ata,
          signer,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
    ixs.push(
      await client.ix.swap({
        signer,
        market: marketPda,
        direction,
        amountIn: amountInMicro,
        minOutput: minOut,
      }),
    );
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.feePayer = signer;
    tx.recentBlockhash = blockhash;
    tx.add(...ixs);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const outHuman = (q.out / 1_000_000).toFixed(4);
    return {
      transactionBase64: Buffer.from(serialized).toString("base64"),
      message: `Buy ~${outHuman} ${side.toUpperCase()} with ${amountUsdc} mUSDC (devnet · 2% fee · 1% slip)`,
    };
  });
}

app.get("/actions.json", (c) =>
  c.json({
    rules: [
      { pathPattern: "/*", apiPath: "/api/actions/*" },
      { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
    ],
  }),
);

app.get("/icon.svg", (c) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#14F195"/><stop offset="100%" stop-color="#9945FF"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="96" fill="#0B0B12"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="url(#g)" stroke-width="28"/>
  <path d="M160 280 L240 200 L300 260 L360 180" fill="none" stroke="url(#g)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="360" cy="180" r="18" fill="#14F195"/>
  <text x="256" y="455" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="42" font-weight="700" fill="#E8E8F0">StrikeBlink</text>
</svg>`;
  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});

app.get("/api/actions/trade", async (c) => {
  try {
    const marketParam = c.req.query("market");
    const resolved = await resolveMarket(marketParam);
    const base = baseUrl(c);
    if (!resolved) {
      return c.json({
        type: "action",
        title: "StrikeBlink",
        icon: `${base}/icon.svg`,
        description: "No open unresolved markets on PREDICT pm-AMM (devnet) right now.",
        label: "No markets",
        disabled: true,
        error: { message: "No open markets found on devnet." },
      });
    }
    const { meta, account } = resolved;
    const state = marketState(account);
    const m = encodeURIComponent(meta.pda);
    const body = {
      type: "action",
      title: meta.name,
      icon: `${base}/icon.svg`,
      description: `YES ${formatPct(state.price)} · NO ${formatPct(1 - state.price)} · Ends in ${formatCountdown(state.secondsLeft)} · devnet · pm-AMM · market #${meta.id}`,
      label: "Buy",
      links: {
        actions: [
          {
            type: "transaction",
            label: `Buy YES ${DEFAULT_AMOUNT_USDC}`,
            href: `${base}/api/actions/trade?market=${m}&side=yes&amount=${DEFAULT_AMOUNT_USDC}`,
          },
          {
            type: "transaction",
            label: `Buy NO ${DEFAULT_AMOUNT_USDC}`,
            href: `${base}/api/actions/trade?market=${m}&side=no&amount=${DEFAULT_AMOUNT_USDC}`,
          },
          {
            type: "transaction",
            label: "Buy YES",
            href: `${base}/api/actions/trade?market=${m}&side=yes&amount={amount}`,
            parameters: [
              { name: "amount", label: "mUSDC amount", type: "number", required: true, min: 1, max: 1000 },
            ],
          },
          {
            type: "transaction",
            label: "Buy NO",
            href: `${base}/api/actions/trade?market=${m}&side=no&amount={amount}`,
            parameters: [
              { name: "amount", label: "mUSDC amount", type: "number", required: true, min: 1, max: 1000 },
            ],
          },
        ],
      },
    };
    if (state.expired || state.resolved) {
      body.disabled = true;
      body.label = "Market closed";
      body.error = { message: "This market is resolved or expired." };
      delete body.links;
    }
    return c.json(body);
  } catch (e) {
    return c.json({ message: e.message || "Failed to load action" }, 500);
  }
});

app.post("/api/actions/trade", async (c) => {
  try {
    const body = await c.req.json();
    const account = body?.account;
    if (!account || typeof account !== "string") {
      return c.json({ message: "Missing body.account (base58 pubkey)" }, 400);
    }
    const marketParam = c.req.query("market");
    const side = String(c.req.query("side") || "yes").toLowerCase() === "no" ? "no" : "yes";
    const amount = Number(c.req.query("amount") ?? DEFAULT_AMOUNT_USDC);
    const resolved = await resolveMarket(marketParam);
    if (!resolved) return c.json({ message: "Market not found or no open markets" }, 404);
    const built = await buildUnsignedSwapTx({
      account,
      marketPda: resolved.pda,
      marketAccount: resolved.account,
      side,
      amountUsdc: amount,
    });
    return c.json({
      type: "transaction",
      transaction: built.transactionBase64,
      message: built.message,
    });
  } catch (e) {
    const status = e.code === "MARKET_CLOSED" || e.code === "BAD_AMOUNT" ? 400 : 500;
    return c.json({ message: e.message || "Failed to build transaction" }, status);
  }
});

app.get("/api/markets", async (c) => {
  try {
    const markets = await listOpenMarkets(12);
    return c.json({
      cluster: "devnet",
      count: markets.length,
      markets,
      faucet: FAUCET_URL,
      referenceApp: REF_APP,
    });
  } catch (e) {
    return c.json({ message: e.message || "Failed to list markets" }, 500);
  }
});

app.get("/", async (c) => {
  let markets = [];
  let errMsg = "";
  try {
    markets = await listOpenMarkets(10);
  } catch (e) {
    errMsg = e.message || String(e);
  }
  const base = baseUrl(c);
  const escape = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = markets
    .map((m) => {
      const actionUrl = `${base}/api/actions/trade?market=${encodeURIComponent(m.pda)}`;
      const dial = `https://dial.to/?action=${encodeURIComponent(`solana-action:${actionUrl}`)}`;
      return `<tr><td><strong>${escape(m.name)}</strong><br/><span class="muted">#${m.id}</span></td>
        <td>YES ${formatPct(m.yesPrice)}<br/>NO ${formatPct(m.noPrice)}</td>
        <td>${formatCountdown(m.secondsLeft)}</td>
        <td class="links"><a href="${dial}" target="_blank" rel="noopener">Open Blink</a>
        <a href="${m.appUrl}" target="_blank" rel="noopener">pm-AMM</a></td></tr>`;
    })
    .join("\n");
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>StrikeBlink</title>
<style>
:root{color-scheme:dark;--bg:#0B0B12;--card:#16161F;--fg:#E8E8F0;--muted:#9A9AB0;--yes:#14F195;--line:#2A2A3A}
body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header,main{max-width:900px;margin:0 auto;padding:1.25rem}h1{background:linear-gradient(90deg,#14F195,#9945FF);-webkit-background-clip:text;background-clip:text;color:transparent}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1rem;overflow:auto}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.75rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
.muted{color:var(--muted);font-size:.8rem}.links{display:flex;flex-direction:column;gap:.35rem}a{color:var(--yes)}
.pill{display:inline-block;padding:.15rem .55rem;border-radius:999px;background:#1E1E2C;color:var(--muted);font-size:.75rem;margin-right:.35rem}
footer{color:var(--muted);font-size:.8rem;margin-top:1.5rem}code{background:#1E1E2C;padding:.1rem .35rem;border-radius:6px}
</style></head><body>
<header><h1>StrikeBlink</h1><p class="muted">One-click YES/NO trades via Solana Actions / Blinks.<br/>
<span class="pill">devnet</span><span class="pill">pm-AMM</span><span class="pill">MLH Solana Hackathon</span></p></header>
<main><div class="card">${errMsg ? `<p style="color:#ff7b7b">Failed: ${escape(errMsg)}</p>` : ""}
${markets.length === 0 && !errMsg ? `<p class="muted">No open markets. Try <a href="${REF_APP}">pm-amm-devnet</a>.</p>` : `<table><thead><tr><th>Market</th><th>Odds</th><th>Ends</th><th>Trade</th></tr></thead><tbody>${rows}</tbody></table>`}
</div>
<footer><p>Action: <code>${escape(base)}/api/actions/trade</code></p>
<p>Repo: <a href="https://github.com/LMH-Solutions/strikeblink">LMH-Solutions/strikeblink</a> · MIT · Grok Bot · No StrikeBook code reused.</p></footer>
</main></body></html>`);
});

export default app;
