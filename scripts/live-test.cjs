'use strict';
// Read-only devnet smoke test. Never signs, sends, requests a faucet, or stores keys.
const assert = require('node:assert/strict');
const { Keypair, Transaction } = require('@solana/web3.js');
const { createApp } = require('../dist/app');
(async () => {
  const app = createApp();
  for (const path of ['/actions.json', '/health', '/api/markets', '/api/actions/trade']) {
    const r = await app.request('http://localhost:8787'+path);
    const data = await r.json();
    assert.equal(r.status,200,`${path}: ${JSON.stringify(data)}`);
    console.log(`OK ${path}${path === '/api/markets' ? ` (${data.markets.length} open SOL markets)` : ''}`);
    if (path === '/api/markets' && !data.markets.length) throw new Error('No open SOL market: live swap-build not verified.');
  }
  const account = Keypair.generate().publicKey.toBase58();
  for (const side of ['yes','no']) {
    const r = await app.request(`http://localhost:8787/api/actions/trade?side=${side}&amount=5`, {
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account}),
    });
    const data = await r.json(); assert.equal(r.status,200,JSON.stringify(data));
    const tx = Transaction.from(Buffer.from(data.transaction,'base64'));
    assert(tx.signatures.every(s=>s.signature===null));
    console.log(`OK live ${side.toUpperCase()} unsigned transaction (${tx.instructions.length} instructions, no signatures)`);
  }
})().catch(e=>{ console.error(`FAIL ${e.message}`); process.exitCode=1; });
