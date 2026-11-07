"use strict";

const { PublicKey } = require("@solana/web3.js");
const { getClient } = require("./client.cjs");
const { marketState } = require("./helpers/pm-amm-helpers.cjs");
const { MARKET_DATA_SIZE, REF_APP } = require("./config.cjs");

function decodeName(nameField) {
  if (!nameField) return "";
  if (typeof nameField === "string") return nameField.trim();
  const bytes = Array.isArray(nameField) ? Uint8Array.from(nameField) : nameField;
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return Buffer.from(bytes.subarray(0, end)).toString("utf8").trim();
}

/** BN / bigint / number → Number when safe, else string (for display / PDA seeds). */
function bnToSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") {
    return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  }
  if (typeof v.toString === "function") {
    const s = v.toString(10);
    // Prefer number when it fits; marketPda accepts number|bigint
    if (/^\d+$/.test(s) && Number(s) <= Number.MAX_SAFE_INTEGER) return Number(s);
    return s;
  }
  return Number(v);
}

function bnToNumberOrThrowish(v) {
  // For timestamps we expect i64 unix secs — always safe as Number.
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toNumber === "function") {
    try {
      return v.toNumber();
    } catch {
      return Number(v.toString(10));
    }
  }
  return Number(v.toString ? v.toString(10) : v);
}

/**
 * List open, unresolved markets from pm-AMM (devnet).
 * Filters endTs > now and !resolved. Returns up to `limit` sorted by soonest end.
 */
async function listOpenMarkets(limit = 8) {
  const client = getClient();
  const all = await client.fetchAllMarkets(MARKET_DATA_SIZE);
  const now = Math.floor(Date.now() / 1000);
  const open = [];

  for (const row of all) {
    try {
      const m = row.account;
      const endTs = bnToNumberOrThrowish(m.endTs);
      if (m.resolved) continue;
      if (!(endTs > now)) continue;
      const state = marketState(m, now);
      const id = bnToSafe(m.marketId);
      open.push({
        id,
        pda: row.publicKey.toBase58(),
        name: decodeName(m.name) || `Market #${id}`,
        yesPrice: state.price,
        noPrice: 1 - state.price,
        endTs,
        secondsLeft: state.secondsLeft,
        appUrl: `${REF_APP}/market/${id}`,
      });
    } catch (e) {
      // Skip malformed / legacy accounts rather than failing the whole list.
      console.warn("skip market", row.publicKey?.toBase58?.(), e.message);
    }
  }

  open.sort((a, b) => a.endTs - b.endTs);
  return open.slice(0, limit);
}

/**
 * Resolve a market from query: numeric id or base58 PDA.
 */
async function resolveMarket(marketParam) {
  const client = getClient();
  if (!marketParam) {
    const open = await listOpenMarkets(1);
    if (!open.length) return null;
    const pda = new PublicKey(open[0].pda);
    const account = await client.fetchMarket(pda);
    return account ? { pda, account, id: open[0].id, meta: open[0] } : null;
  }

  // numeric market id (may be > 53 bits — pass as bigint to marketPda)
  if (/^\d+$/.test(String(marketParam))) {
    const raw = String(marketParam);
    const idForPda = BigInt(raw);
    const idDisplay =
      idForPda <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(idForPda) : raw;
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
        endTs: bnToNumberOrThrowish(account.endTs),
        secondsLeft: state.secondsLeft,
        appUrl: `${REF_APP}/market/${idDisplay}`,
      },
    };
  }

  // PDA
  let pda;
  try {
    pda = new PublicKey(marketParam);
  } catch {
    return null;
  }
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
      endTs: bnToNumberOrThrowish(account.endTs),
      secondsLeft: state.secondsLeft,
      appUrl: `${REF_APP}/market/${id}`,
    },
  };
}

module.exports = { listOpenMarkets, resolveMarket, decodeName };
