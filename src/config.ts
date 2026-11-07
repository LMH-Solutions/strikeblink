import { PublicKey } from '@solana/web3.js';
export const PROGRAM_ID = new PublicKey('GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y');
export const USDC_MINT = new PublicKey('3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ');
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEVNET_CHAIN_ID = DEVNET_GENESIS.slice(0, 32);
export const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
export const PORT = Number(process.env.PORT || 8787);
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
export const REF_APP = 'https://pm-amm-devnet.vercel.app';
export const FAUCET_URL = `${REF_APP}/api/faucet`;
export const DEFAULT_AMOUNT = '5';
export class ActionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 503 = 400) { super(message); }
}
export function parseAmount(value: string = DEFAULT_AMOUNT): number {
  // Exact decimal parsing: reject rounding, exponents, Infinity, and unreasonable buys.
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(value))
    throw new ActionError('Amount must be a decimal with at most 6 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const raw = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
  if (raw < 1_000_000 || raw > 1_000_000_000)
    throw new ActionError('Amount must be between 1 and 1000 mUSDC.');
  return raw;
}
export function parseWallet(value: unknown): PublicKey {
  try {
    if (typeof value !== 'string') throw new Error();
    const key = new PublicKey(value);
    if (!PublicKey.isOnCurve(key.toBytes())) throw new Error();
    return key;
  } catch { throw new ActionError('body.account must be an on-curve Solana wallet public key.'); }
}
export function parseSide(value: string | undefined): 'yes' | 'no' {
  if (value !== 'yes' && value !== 'no') throw new ActionError('side must be yes or no.');
  return value;
}
