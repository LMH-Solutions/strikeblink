import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ACTIONS_CORS_HEADERS } from '@solana/actions';
import { ActionError, DEFAULT_AMOUNT, DEVNET_CHAIN_ID, FAUCET_URL, PUBLIC_BASE_URL, parseAmount, parseSide, parseWallet } from './config';
import { listOpenMarkets, resolveMarket } from './markets';
import { buildUnsignedSwapTx } from './build-swap-tx';
import { marketState } from './helpers/pm-amm-helpers';
import { home, icon } from './view';
export function createApp(deps = { listOpenMarkets, resolveMarket, buildUnsignedSwapTx }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    for (const [name, value] of Object.entries(ACTIONS_CORS_HEADERS)) c.header(name, value);
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept-Encoding');
    c.header('Access-Control-Expose-Headers', 'X-Action-Version,X-Blockchain-Ids');
    c.header('X-Action-Version', '2.4');
    c.header('X-Blockchain-Ids', `solana:${DEVNET_CHAIN_ID}`);
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await next();
  });
  app.use('*', bodyLimit({ maxSize: 4096, onError: c => c.json({ message: 'Request body too large.' }, 413) }));
  app.onError((error, c) => {
    if (error instanceof ActionError) return c.json({ message: error.message }, error.status);
    // Do not expose RPC URLs, provider responses, stack traces, or request payloads.
    return c.json({ message: 'Devnet service unavailable. Please retry later.' }, 503);
  });
  app.notFound(c => c.json({ message: 'Not found.' }, 404));
  app.get('/health', c => c.json({ ok: true, cluster: 'devnet', service: 'StrikeBlink' }));
  app.get('/actions.json', c => c.json({ rules: [
    { pathPattern: '/trade', apiPath: '/api/actions/trade' },
    { pathPattern: '/api/actions/**', apiPath: '/api/actions/**' },
  ] }));
  app.get('/icon.svg', c => c.body(icon, 200, { 'Content-Type': 'image/svg+xml' }));
  app.get('/api/markets', async c => c.json({ cluster: 'devnet', markets: await deps.listOpenMarkets(), faucet: FAUCET_URL }));
  const metadata = async (c: import('hono').Context) => {
    const base = PUBLIC_BASE_URL || new URL(c.req.url).origin;
    const market = await deps.resolveMarket(c.req.query('market'));
    const common = { type: 'action' as const, icon: `${base}/icon.svg` };
    if (!market) return c.json({ ...common, title: 'StrikeBlink', label: 'No markets', disabled: true,
      description: 'No open SOL strike markets on devnet. Test tokens have no monetary value.',
      error: { message: 'No open SOL markets. Try again when a market is available.' } });
    const { meta, account } = market;
    const state = marketState(account);
    const closed = state.expired || state.resolved || state.secondsLeft < 30 || state.lEff <= 0;
    const description = `YES ${(state.price * 100).toFixed(1)}% · NO ${((1-state.price)*100).toFixed(1)}% · ${Math.ceil(state.secondsLeft/60)}m left. Devnet only · 2% buy fee included · 1% slippage. Creator resolves outcome; no oracle guarantee.`;
    const href = `${base}/api/actions/trade?market=${encodeURIComponent(meta.pda)}`;
    return c.json({ ...common, title: meta.name, description, label: closed ? 'Market closed' : 'Buy with mUSDC',
      ...(closed ? { disabled: true, error: { message: 'Market closed, too close to expiry, or without liquidity.' } } : {
        links: { actions: ['yes', 'no'].flatMap(side => [
          { type: 'transaction', label: `Buy ${side.toUpperCase()} ${DEFAULT_AMOUNT} mUSDC`, href: `${href}&side=${side}&amount=${DEFAULT_AMOUNT}` },
          { type: 'transaction', label: `Buy ${side.toUpperCase()} custom`, href: `${href}&side=${side}&amount={amount}`,
            parameters: [{ name: 'amount', label: 'mUSDC (1–1000)', type: 'number', required: true, min: 1, max: 1000 }] },
        ]) },
      }),
    });
  };
  app.get('/api/actions/trade', metadata);
  app.get('/trade', c => c.redirect(`/?${new URL(c.req.url).searchParams}`, 302));
  app.post('/api/actions/trade', async c => {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new ActionError('Body must be valid JSON.'); }
    const signer = parseWallet(body && typeof body === 'object' ? (body as { account?: unknown }).account : undefined);
    const side = parseSide(c.req.query('side'));
    const amountInMicro = parseAmount(c.req.query('amount'));
    const market = await deps.resolveMarket(c.req.query('market'));
    if (!market) throw new ActionError('No matching SOL market found.', 404);
    const built = await deps.buildUnsignedSwapTx({ signer, side, amountInMicro, marketPda: market.pda, marketAccount: market.account });
    return c.json({ type: 'transaction', transaction: built.transaction, message: built.message });
  });
  app.get('/', async c => {
    const base = PUBLIC_BASE_URL || new URL(c.req.url).origin;
    try { return c.html(home(base, await deps.listOpenMarkets())); }
    catch { return c.html(home(base, [], 'Devnet is temporarily unavailable. Retry shortly.')); }
  });
  return app;
}
