import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';

declare global {
  // eslint-disable-next-line no-var
  var __slaApiApp: FastifyInstance | undefined;
}

const getApp = async () => {
  if (!global.__slaApiApp) {
    const { buildApp } = await import('../dist/app.js');
    global.__slaApiApp = await buildApp();
    await global.__slaApiApp.ready();
  }
  return global.__slaApiApp;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('API handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
};
