import { serve } from '@hono/node-server';
import { createApp } from './app';
import { PORT } from './config';
const server = serve({ fetch: createApp().fetch, hostname: '0.0.0.0', port: PORT },
  info => console.log(`StrikeBlink devnet server listening on port ${info.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
