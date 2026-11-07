"use strict";

/**
 * StrikeBlink — Solana Actions / Blinks server for PREDICT pm-AMM (devnet).
 * Written during MLH Solana Hackathon (Nov 6–8 2026). No StrikeBook code.
 */

const path = require("path");
const express = require("express");
const { ACTIONS_CORS_HEADERS } = require("@solana/actions");
const {
  PORT,
  PUBLIC_BASE_URL,
  DEFAULT_AMOUNT_USDC,
  REF_APP,
  FAUCET_URL,
} = require("./config.cjs");
const { listOpenMarkets, resolveMarket } = require("./markets.cjs");
const { buildUnsignedSwapTx } = require("./build-swap-tx.cjs");
const { marketState } = require("./helpers/pm-amm-helpers.cjs");

const app = express();
app.use(express.json({ limit: "32kb" }));

// ---- Actions CORS on every response (required by Solana Actions spec) ----
const CORS = {
  ...ACTIONS_CORS_HEADERS,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  "X-Action-Version": "2.4",
  "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet CAIP-2
};

function applyCors(_req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

function baseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

function iconUrl(req) {
  return `${baseUrl(req)}/icon.svg`;
}

function actionError(res, status, message) {
  return res.status(status).json({ message });
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

// ---- actions.json (root) ----
app.get("/actions.json", (_req, res) => {
  res.json({
    rules: [
      {
        pathPattern: "/*",
        apiPath: "/api/actions/*",
      },
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**",
      },
    ],
  });
});

// ---- Icon ----
app.get("/icon.svg", (_req, res) => {
  res.type("image/svg+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14F195"/>
      <stop offset="100%" stop-color="#9945FF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#0B0B12"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="url(#g)" stroke-width="28"/>
  <path d="M160 280 L240 200 L300 260 L360 180" fill="none" stroke="url(#g)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="360" cy="180" r="18" fill="#14F195"/>
  <text x="256" y="455" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="42" font-weight="700" fill="#E8E8F0">StrikeBlink</text>
</svg>`);
});

// ---- GET/POST /api/actions/trade ----
app.get("/api/actions/trade", async (req, res) => {
  try {
    const marketParam = req.query.market;
    const resolved = await resolveMarket(marketParam);
    if (!resolved) {
      return res.status(200).json({
        type: "action",
        title: "StrikeBlink",
        icon: iconUrl(req),
        description:
          "No open unresolved markets on PREDICT pm-AMM (devnet) right now. Check back soon, or open a market on the reference app.",
        label: "No markets",
        disabled: true,
        error: { message: "No open markets found on devnet." },
      });
    }

    const { meta, account } = resolved;
    const state = marketState(account);
    const title = meta.name;
    const description = [
      `YES ${formatPct(state.price)} · NO ${formatPct(1 - state.price)}`,
      `Ends in ${formatCountdown(state.secondsLeft)}`,
      `devnet · pm-AMM · market #${meta.id}`,
    ].join(" · ");

    const base = baseUrl(req);
    const m = encodeURIComponent(meta.pda);

    const body = {
      type: "action",
      title,
      icon: iconUrl(req),
      description,
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
              {
                name: "amount",
                label: "mUSDC amount",
                type: "number",
                required: true,
                min: 1,
                max: 1000,
              },
            ],
          },
          {
            type: "transaction",
            label: "Buy NO",
            href: `${base}/api/actions/trade?market=${m}&side=no&amount={amount}`,
            parameters: [
              {
                name: "amount",
                label: "mUSDC amount",
                type: "number",
                required: true,
                min: 1,
                max: 1000,
              },
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

    return res.json(body);
  } catch (e) {
    console.error("GET /api/actions/trade", e);
    return actionError(res, 500, e.message || "Failed to load action");
  }
});

app.post("/api/actions/trade", async (req, res) => {
  try {
    const account = req.body?.account;
    if (!account || typeof account !== "string") {
      return actionError(res, 400, "Missing body.account (base58 pubkey)");
    }

    const marketParam = req.query.market;
    const side = String(req.query.side || "yes").toLowerCase() === "no" ? "no" : "yes";
    const amount = Number(req.query.amount ?? DEFAULT_AMOUNT_USDC);

    const resolved = await resolveMarket(marketParam);
    if (!resolved) {
      return actionError(res, 404, "Market not found or no open markets");
    }

    const built = await buildUnsignedSwapTx({
      account,
      marketPda: resolved.pda,
      marketAccount: resolved.account,
      side,
      amountUsdc: amount,
    });

    return res.json({
      type: "transaction",
      transaction: built.transactionBase64,
      message: built.message,
    });
  } catch (e) {
    console.error("POST /api/actions/trade", e);
    const status = e.code === "MARKET_CLOSED" || e.code === "BAD_AMOUNT" ? 400 : 500;
    return actionError(res, status, e.message || "Failed to build transaction");
  }
});

// ---- Markets list API ----
app.get("/api/markets", async (_req, res) => {
  try {
    const markets = await listOpenMarkets(12);
    res.json({
      cluster: "devnet",
      count: markets.length,
      markets,
      faucet: FAUCET_URL,
      referenceApp: REF_APP,
    });
  } catch (e) {
    console.error("GET /api/markets", e);
    actionError(res, 500, e.message || "Failed to list markets");
  }
});

// ---- Mobile fallback HTML ----
app.get("/", async (req, res) => {
  let markets = [];
  let errMsg = "";
  try {
    markets = await listOpenMarkets(10);
  } catch (e) {
    errMsg = e.message || String(e);
  }

  const base = baseUrl(req);
  const rows = markets
    .map((m) => {
      const actionUrl = `${base}/api/actions/trade?market=${encodeURIComponent(m.pda)}`;
      const dial = `https://dial.to/?action=${encodeURIComponent(`solana-action:${actionUrl}`)}`;
      return `<tr>
        <td><strong>${escapeHtml(m.name)}</strong><br/><span class="muted">#${m.id}</span></td>
        <td>YES ${formatPct(m.yesPrice)}<br/>NO ${formatPct(m.noPrice)}</td>
        <td>${formatCountdown(m.secondsLeft)}</td>
        <td class="links">
          <a href="${dial}" target="_blank" rel="noopener">Open Blink</a>
          <a href="${m.appUrl}" target="_blank" rel="noopener">pm-AMM</a>
        </td>
      </tr>`;
    })
    .join("\n");

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>StrikeBlink — one-click strike trades</title>
  <meta name="description" content="Solana Actions/Blinks for short-dated prediction markets on PREDICT pm-AMM (devnet). MLH Solana Hackathon."/>
  <style>
    :root { color-scheme: dark; --bg:#0B0B12; --card:#16161F; --fg:#E8E8F0; --muted:#9A9AB0; --yes:#14F195; --no:#9945FF; --line:#2A2A3A; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:var(--bg); color:var(--fg); line-height:1.45; }
    header { padding:1.5rem 1.25rem 0.5rem; max-width:900px; margin:0 auto; }
    h1 { margin:0 0 .35rem; font-size:1.75rem; background:linear-gradient(90deg,#14F195,#9945FF); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .sub { color:var(--muted); font-size:.95rem; }
    main { max-width:900px; margin:0 auto; padding:1rem 1.25rem 3rem; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:1rem; overflow:auto; }
    table { width:100%; border-collapse:collapse; font-size:.92rem; }
    th, td { text-align:left; padding:.75rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; }
    .muted { color:var(--muted); font-size:.8rem; }
    .links { display:flex; flex-direction:column; gap:.35rem; }
    a { color:var(--yes); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .pill { display:inline-block; padding:.15rem .55rem; border-radius:999px; background:#1E1E2C; color:var(--muted); font-size:.75rem; margin-right:.35rem; }
    footer { margin-top:1.5rem; color:var(--muted); font-size:.8rem; }
    code { background:#1E1E2C; padding:.1rem .35rem; border-radius:6px; font-size:.85em; }
    .err { color:#ff7b7b; margin:.5rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>StrikeBlink</h1>
    <p class="sub">One-click YES/NO trades on short-dated strike markets via Solana Actions / Blinks.<br/>
      <span class="pill">devnet</span><span class="pill">pm-AMM</span><span class="pill">MLH Solana Hackathon</span>
    </p>
  </header>
  <main>
    <div class="card">
      ${errMsg ? `<p class="err">Failed to load markets: ${escapeHtml(errMsg)}</p>` : ""}
      ${
        markets.length === 0 && !errMsg
          ? `<p class="muted">No open unresolved markets right now. Create one on <a href="${REF_APP}" target="_blank" rel="noopener">pm-amm-devnet</a> or wait for a keeper to open a strike.</p>`
          : `<table>
        <thead><tr><th>Market</th><th>Odds</th><th>Ends</th><th>Trade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
      }
    </div>
    <footer>
      <p>Action endpoint: <code>${escapeHtml(base)}/api/actions/trade</code></p>
      <p>Get free mUSDC: <code>POST ${FAUCET_URL}</code> with <code>{"wallet":"..."}</code></p>
      <p>Repo: <a href="https://github.com/LMH-Solutions/strikeblink">github.com/LMH-Solutions/strikeblink</a> · MIT · Built with Grok Bot during the event. No StrikeBook code reused.</p>
    </footer>
  </main>
</body>
</html>`);
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StrikeBlink listening on http://0.0.0.0:${PORT}`);
  console.log(`RPC ${require("./config.cjs").RPC_URL}`);
  if (PUBLIC_BASE_URL) console.log(`PUBLIC_BASE_URL ${PUBLIC_BASE_URL}`);
});
