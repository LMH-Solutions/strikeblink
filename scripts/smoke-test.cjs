'use strict';
const assert = require('node:assert/strict');
const { Keypair, Transaction } = require('@solana/web3.js');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
(async()=>{
  let market;
  for(const path of ['/health','/actions.json','/api/markets','/api/actions/trade']) {
    const r=await fetch(BASE+path,{signal:AbortSignal.timeout(20000)});
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));
    if(path==='/api/markets')market=data.markets[0];
    console.log(`OK ${path}`);
  }
  assert(market,'No open SOL market: swap build is not verified');
  for(const side of ['yes','no']) {
    const r=await fetch(`${BASE}/api/actions/trade?market=${market.pda}&side=${side}&amount=5`,{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:Keypair.generate().publicKey.toBase58()}),signal:AbortSignal.timeout(20000)});
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));
    assert(data.transaction);const tx=Transaction.from(Buffer.from(data.transaction,'base64'));
    assert(tx.signatures.every(s=>s.signature===null));console.log(`OK POST ${side}: unsigned transaction`);
  }
})().catch(e=>{console.error(`FAIL ${e.message}`);process.exitCode=1});
