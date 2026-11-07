import { PublicKey } from '@solana/web3.js';
import type { MarketAccount } from '@pm-amm/sdk';
import { client, requireDevnet } from './client';
import { ActionError, REF_APP, USDC_MINT } from './config';
import { marketState } from './helpers/pm-amm-helpers';
export function decodeName(value: number[]): string {
  return Buffer.from(value).toString('utf8').replace(/\0.*$/s, '').trim();
}
export function isStrikeMarket(account: MarketAccount): boolean {
  return /\bSOL\b/i.test(decodeName(account.name)) && account.collateralMint.equals(USDC_MINT);
}
export function marketMeta(pda: PublicKey, account: MarketAccount) {
  const state = marketState(account);
  return { id: account.marketId.toString(), pda: pda.toBase58(), name: decodeName(account.name),
    yesPrice: state.price, noPrice: 1 - state.price, endTs: account.endTs.toNumber(),
    secondsLeft: state.secondsLeft, appUrl: `${REF_APP}/market/${account.marketId.toString()}` };
}
export type MarketMeta = ReturnType<typeof marketMeta>;
export type ResolvedMarket = { pda: PublicKey; account: MarketAccount; meta: MarketMeta };
let cached: MarketMeta[] = [];
let cachedAt = 0;
let inFlight: Promise<MarketMeta[]> | undefined;
export async function listOpenMarkets(): Promise<MarketMeta[]> {
  await requireDevnet();
  if (Date.now() - cachedAt < 15_000) return cached.filter(m => m.endTs > Date.now() / 1000);
  if (!inFlight) inFlight = (async () => {
    const all = await client.fetchAllMarkets(443);
    cached = all.filter(({ account: m }) => isStrikeMarket(m) && !m.resolved &&
      m.endTs.toNumber() > Date.now() / 1000 + 30 && marketState(m).lEff > 0 && m.endTs.toNumber() - m.startTs.toNumber() <= 86_400)
      .map(({ publicKey, account }) => marketMeta(publicKey, account)).sort((a, b) => a.endTs - b.endTs);
    cachedAt = Date.now();
    return cached;
  })().finally(() => { inFlight = undefined; });
  return inFlight;
}
export async function resolveMarket(value?: string): Promise<ResolvedMarket | null> {
  await requireDevnet();
  if (!value) value = (await listOpenMarkets())[0]?.pda;
  if (!value) return null;
  let pda: PublicKey;
  try {
    if (/^\d+$/.test(value)) {
      if (BigInt(value) > 18446744073709551615n) throw new Error();
      pda = client.marketPda(BigInt(value));
    } else pda = new PublicKey(value);
  } catch { throw new ActionError('market must be a base58 address or uint64 market ID.'); }
  const account = await client.fetchMarket(pda);
  if (!account) return null;
  if (!isStrikeMarket(account) || account.endTs.toNumber() - account.startTs.toNumber() > 86_400)
    throw new ActionError('Only SOL markets of at most 24 hours with devnet mUSDC are supported.');
  return { pda, account, meta: marketMeta(pda, account) };
}
