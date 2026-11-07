import { Connection } from '@solana/web3.js';
import { PmAmmClient } from '@pm-amm/sdk';
import { ActionError, DEVNET_GENESIS, PROGRAM_ID, RPC_URL, USDC_MINT } from './config';
export const connection = new Connection(RPC_URL, {
  commitment: 'confirmed', disableRetryOnRateLimit: true,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }),
});
export const client = PmAmmClient.readOnly(connection, PROGRAM_ID, USDC_MINT);
let verified = false;
let pending: Promise<void> | undefined;
export async function requireDevnet(): Promise<void> {
  if (verified) return;
  if (!pending) pending = (async () => {
    if (await connection.getGenesisHash() !== DEVNET_GENESIS)
      throw new ActionError('RPC is not Solana devnet. Refusing to build transactions.', 503);
    verified = true;
  })().finally(() => { pending = undefined; });
  await pending;
}
