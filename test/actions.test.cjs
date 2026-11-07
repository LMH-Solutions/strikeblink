const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Transaction, ComputeBudgetProgram } = require('@solana/web3.js');
const { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = require('@solana/spl-token');
const { client } = require('../dist/client');
const { createApp } = require('../dist/app');
const { parseAmount, PROGRAM_ID, USDC_MINT, DEVNET_CHAIN_ID } = require('../dist/config');
const { marketMeta } = require('../dist/markets');
const { buildUnsignedSwapTx } = require('../dist/build-swap-tx');
const { quoteSwap, minOutput } = require('../dist/helpers/pm-amm-helpers');
const { market, signer, pda, now, BN, PublicKey } = require('./fixtures.cjs');
const localDeps = { client, requireDevnet: async () => {}, connection: {
  getLatestBlockhash: async () => ({ blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: 123 }) } };
function appFor(account = market()) {
  const meta = marketMeta(pda, account);
  return createApp({ listOpenMarkets: async () => [meta], resolveMarket: async () => ({ pda, account, meta }),
    buildUnsignedSwapTx: input => buildUnsignedSwapTx(input, localDeps) });
}
function post(app, query, body = { account: signer.toBase58() }) {
  return app.request('/api/actions/trade?'+query, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) });
}
test('discovery, health, CORS, cluster and SVG', async () => {
  const app = appFor();
  for (const path of ['/health', '/actions.json', '/icon.svg', '/', '/api/markets']) {
    const r = await app.request(path); assert.equal(r.status,200,path);
    assert.equal(r.headers.get('access-control-allow-origin'),'*');
    assert.equal(r.headers.get('x-blockchain-ids'),`solana:${DEVNET_CHAIN_ID}`);
  }
  const discovery = await (await app.request('/actions.json')).json();
  assert(discovery.rules.some(r => r.apiPath === '/api/actions/**'));
  assert.equal((await app.request('/api/actions/trade', { method:'OPTIONS' })).status,204);
});
test('GET action advertises both sides and fee disclosures', async () => {
  const r = await appFor().request('/api/actions/trade');
  const data = await r.json(); assert.equal(data.type,'action');
  assert.match(data.description,/2% buy fee/); assert.equal(data.links.actions.length,4);
  assert(data.links.actions.some(a=>a.href.includes('side=yes')));
  assert(data.links.actions.some(a=>a.href.includes('side=no')));
});
for (const side of ['yes','no']) test(`POST ${side} serializes a real SDK swap, both outcome ATAs, CU, and zero signatures`, async () => {
  const response = await post(appFor(),`market=987654321&side=${side}&amount=5`);
  const data = await response.json(); assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.type,'transaction'); const tx = Transaction.from(Buffer.from(data.transaction,'base64'));
  assert(tx.feePayer.equals(signer)); assert(tx.signatures.every(s=>s.signature === null));
  assert.equal(tx.instructions.length,5);
  assert(tx.instructions[0].programId.equals(ComputeBudgetProgram.programId));
  for (let i=1;i<=3;i++) assert(tx.instructions[i].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID));
  for (const mint of [USDC_MINT, client.yesMint(pda), client.noMint(pda)]) {
    const ata = getAssociatedTokenAddressSync(mint, signer);
    assert(tx.instructions.slice(1,4).some(ix=>ix.keys.some(k=>k.pubkey.equals(ata))));
  }
  const swap = tx.instructions[4]; assert(swap.programId.equals(PROGRAM_ID));
  assert.equal(swap.data.readBigUInt64LE(9),5_000_000n); // discriminator + direction u8
  assert(swap.data.readBigUInt64LE(17)>0n); // min_output protection
  assert.match(data.message,/2% fee included/);
});
test('exact amount parser rejects unsafe values and honors micro-units', () => {
  assert.equal(parseAmount('5.000001'),5_000_001);
  assert.equal(parseAmount('1000'),1_000_000_000);
  for (const bad of ['NaN','Infinity','-1','0','0.999999','1000.000001','1e2','1.0000001','','5junk'])
    assert.throws(()=>parseAmount(bad),undefined,bad);
});
test('fee-aware quotes and slippage floor in both directions', () => {
  for (const direction of ['usdcToYes','usdcToNo']) {
    const q = quoteSwap(market(),direction,5_000_000,now);
    assert.equal(q.fee,100_000); assert(q.out>5_000_000);
    assert.equal(minOutput(q),Math.floor(q.out*0.99));
  }
});
test('invalid account, side, amount and JSON are 400; oversized body 413', async () => {
  const app=appFor();
  for (const [query,body] of [['side=maybe&amount=5',undefined],['side=yes&amount=-5',undefined],
    ['side=no&amount=NaN',undefined],['side=yes&amount=5',{account:'not-a-wallet'}],['side=yes',{}]])
    assert.equal((await post(app,query,body)).status,400);
  assert.equal((await app.request('/api/actions/trade',{method:'POST',body:'{'})).status,400);
  assert.equal((await app.request('/api/actions/trade',{method:'POST',body:'x'.repeat(5000)})).status,413);
});
test('closed markets disable card and reject POST', async () => {
  for (const account of [market({resolved:true,winningSide:1}),market({endTs:new BN(now-1)}),market({endTs:new BN(now+10)})]) {
    const app=appFor(account);
    const card=await (await app.request('/api/actions/trade')).json();
    assert.equal(card.disabled,true); assert.equal(card.links,undefined);
    assert.equal((await post(app,'side=yes&amount=5')).status,409);
  }
});
test('empty markets are disabled, not silently treated as successful trades',async()=>{
  const app=createApp({listOpenMarkets:async()=>[],resolveMarket:async()=>null,buildUnsignedSwapTx});
  const card=await(await app.request('/api/actions/trade')).json();assert.equal(card.disabled,true);
  assert.equal((await post(app,'side=yes&amount=5')).status,404);
});
test('wrong mint and wrong cluster cannot produce transaction',async()=>{
  await assert.rejects(buildUnsignedSwapTx({signer,marketPda:pda,marketAccount:market({collateralMint:PublicKey.default}),side:'yes',amountInMicro:5_000_000},localDeps),/collateral/);
  await assert.rejects(buildUnsignedSwapTx({signer,marketPda:pda,marketAccount:market(),side:'yes',amountInMicro:5_000_000},{...localDeps,requireDevnet:async()=>{throw new Error('wrong cluster')}}),/wrong cluster/);
});
test('upstream failures return safe 503 with CORS and never expose RPC details',async()=>{
  const app=createApp({listOpenMarkets:async()=>[],resolveMarket:async()=>{throw new Error('https://rpc.example/?api-key=DO_NOT_EXPOSE')},buildUnsignedSwapTx});
  const r=await app.request('/api/actions/trade');assert.equal(r.status,503);
  assert(!((await r.text()).includes('DO_NOT_EXPOSE')));assert.equal(r.headers.get('access-control-allow-origin'),'*');
});
test('market HTML is escaped',async()=>{
  const app=appFor(market({name:[...Buffer.from('<img src=x onerror=alert(1)> SOL')]}));
  const html=await(await app.request('/')).text();assert(!html.includes('<img src=x'));assert(html.includes('&lt;img'));
});
test('real devnet guard rejects a mainnet hash and coalesces concurrent checks',async()=>{
  const runtime=require('../dist/client');
  const original=runtime.connection.getGenesisHash;
  let calls=0;
  runtime.connection.getGenesisHash=async()=>{calls++;return '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';};
  try {
    const results=await Promise.allSettled([runtime.requireDevnet(),runtime.requireDevnet()]);
    assert(results.every(r=>r.status==='rejected'));assert.equal(calls,1);
    runtime.connection.getGenesisHash=async()=>require('../dist/config').DEVNET_GENESIS;
    await runtime.requireDevnet();
  } finally {runtime.connection.getGenesisHash=original;}
});
test('unseeded market disables the card and cannot yield a buy transaction',async()=>{
  const app=appFor(market({lZero:new BN(0),reserveYes:new BN(0),reserveNo:new BN(0)}));
  const card=await(await app.request('/api/actions/trade')).json();assert.equal(card.disabled,true);
  assert.equal((await post(app,'side=yes&amount=5')).status,409);
});
