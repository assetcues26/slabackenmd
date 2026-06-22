import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

declare global {
  // eslint-disable-next-line no-var
  var __slaApiApp: FastifyInstance | undefined;
}

const getApp = async () => {
  if (!global.__slaApiApp) {
    global.__slaApiApp = await buildApp();
    await global.__slaApiApp.ready();
  }
  return global.__slaApiApp;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
