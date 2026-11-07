const { BN } = require('@anchor-lang/core');
const { Keypair, PublicKey } = require('@solana/web3.js');
const { USDC_MINT } = require('../dist/config');
const { client } = require('../dist/client');
const signer = Keypair.generate().publicKey; // No key stored, logged, or used to sign.
const pda = client.marketPda(987654321n);
const now = Math.floor(Date.now()/1000);
const fixed = n => new BN((BigInt(n) << 48n).toString());
function market(overrides = {}) {
  return { authority: signer, marketId: new BN(987654321), collateralMint: USDC_MINT,
    yesMint: client.yesMint(pda), noMint: client.noMint(pda), vault: client.marketVault(pda),
    startTs: new BN(now-300), endTs: new BN(now+3600), lastAccrualTs: new BN(now-60),
    lZero: fixed(1_000_000), reserveYes: fixed(Math.round(1_000_000*Math.sqrt(3660)/Math.sqrt(2*Math.PI))), reserveNo: fixed(Math.round(1_000_000*Math.sqrt(3660)/Math.sqrt(2*Math.PI))),
    resolved: false, winningSide: 0, name: [...Buffer.from('SOL > $180 in one hour?')],
    ...overrides };
}
module.exports = { market, signer, pda, now, BN, PublicKey };
