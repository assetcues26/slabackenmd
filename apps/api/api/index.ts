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

const normalizeVercelRequest = (req: VercelRequest) => {
  let url = req.url || '/';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      url = `${parsed.pathname}${parsed.search}`;
    } catch {
      url = '/';
    }
  }

  if (!url.startsWith('/')) {
    url = `/${url}`;
  }

  req.url = url;

  if (!req.headers.host) {
    const forwardedHost = req.headers['x-forwarded-host'];
    req.headers.host =
      (typeof forwardedHost === 'string' ? forwardedHost : undefined) ||
      process.env.VERCEL_URL ||
      'localhost';
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    normalizeVercelRequest(req);
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
