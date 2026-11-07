"use strict";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";

async function main() {
  const checks = [];
  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, ok: true });
      console.log(`OK  ${name}`);
    } catch (e) {
      checks.push({ name, ok: false, error: e.message });
      console.error(`FAIL ${name}: ${e.message}`);
    }
  }

  await check("actions.json", async () => {
    const r = await fetch(`${BASE}/actions.json`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    if (!j.rules?.length) throw new Error("no rules");
  });

  await check("GET /api/actions/trade", async () => {
    const r = await fetch(`${BASE}/api/actions/trade`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    if (!j.title || !j.icon) throw new Error("missing title/icon");
    console.log("  title:", j.title);
    console.log("  links:", j.links?.actions?.map((a) => a.label).join(", ") || "(none)");
  });

  await check("GET /api/markets", async () => {
    const r = await fetch(`${BASE}/api/markets`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    console.log("  open markets:", j.count);
  });

  await check("POST /api/actions/trade (sample account)", async () => {
    // Well-known System Program is not a user wallet, but PublicKey validates;
    // use a random valid pubkey shape (Phantom-style test key).
    const account = "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"; // public example
    const markets = await (await fetch(`${BASE}/api/markets`)).json();
    const qs = markets.markets?.[0]
      ? `?market=${encodeURIComponent(markets.markets[0].pda)}&side=yes&amount=5`
      : "?side=yes&amount=5";
    const r = await fetch(`${BASE}/api/actions/trade${qs}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account }),
    });
    const j = await r.json();
    if (j.transaction) {
      console.log("  got base64 tx, length", j.transaction.length);
      console.log("  message:", j.message);
    } else if (j.message) {
      console.log("  ActionError:", j.message, "(status", r.status, ")");
    } else {
      throw new Error(`unexpected body ${JSON.stringify(j).slice(0, 200)}`);
    }
  });

  const failed = checks.filter((c) => !c.ok);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
