import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

declare global {
  // eslint-disable-next-line no-var
  var __slaApiApp: FastifyInstance | undefined;
}

const getApp = async (): Promise<FastifyInstance> => {
  if (global.__slaApiApp) {
    return global.__slaApiApp;
  }

  const app = await buildApp();
  await app.ready();
  global.__slaApiApp = app;
  return app;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
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
}
