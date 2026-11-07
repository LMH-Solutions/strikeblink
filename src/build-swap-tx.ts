import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { CU, type MarketAccount, type PmAmmClient } from '@pm-amm/sdk';
import { client, connection, requireDevnet } from './client';
import { ActionError, USDC_MINT } from './config';
import { marketState, minOutput, quoteSwap } from './helpers/pm-amm-helpers';
export interface BuyRequest {
  signer: PublicKey; marketPda: PublicKey; marketAccount: MarketAccount;
  side: 'yes' | 'no'; amountInMicro: number;
}
// Dependency injection permits tests of real SDK instructions without any network or keypair.
export async function buildUnsignedSwapTx(input: BuyRequest, deps: {
  client: PmAmmClient; connection: Pick<Connection, 'getLatestBlockhash'>; requireDevnet: () => Promise<void>;
} = { client, connection, requireDevnet }) {
  await deps.requireDevnet();
  const { signer, marketPda, marketAccount: m, side, amountInMicro } = input;
  if (!m.collateralMint.equals(USDC_MINT)) throw new ActionError('Wrong collateral mint.');
  if (!['yes', 'no'].includes(side)) throw new ActionError('side must be yes or no.');
  if (!Number.isSafeInteger(amountInMicro) || amountInMicro < 1_000_000 || amountInMicro > 1_000_000_000)
    throw new ActionError('Amount must be between 1 and 1000 mUSDC.');
  const state = marketState(m);
  if (state.expired || state.resolved || state.secondsLeft < 30)
    throw new ActionError('Market is closed or expires in less than 30 seconds.', 409);
  const quote = quoteSwap(m, side === 'yes' ? 'usdcToYes' : 'usdcToNo', amountInMicro);
  const minimum = minOutput(quote, 100);
  if (!Number.isFinite(quote.out) || minimum < 1) throw new ActionError('Insufficient liquidity for a safe quote.', 409);
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: CU.HEAVY }));
  for (const mint of [USDC_MINT, deps.client.yesMint(marketPda), deps.client.noMint(marketPda)])
    tx.add(createAssociatedTokenAccountIdempotentInstruction(signer,
      getAssociatedTokenAddressSync(mint, signer), signer, mint));
  tx.add(await deps.client.ix.swap({ signer, market: marketPda,
    direction: side === 'yes' ? 'usdcToYes' : 'usdcToNo', amountIn: amountInMicro,
    minOutput: minimum, creatorAuthority: m.authority }));
  const latest = await deps.connection.getLatestBlockhash('confirmed');
  tx.feePayer = signer;
  tx.recentBlockhash = latest.blockhash;
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
    message: `Buy ~${(quote.out / 1e6).toFixed(4)} ${side.toUpperCase()} for ${amountInMicro / 1e6} mUSDC. Devnet only; 2% fee included; 1% slippage.`,
    quote: { ...quote, minimum, amountInMicro },
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
