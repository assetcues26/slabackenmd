import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';

declare global {
  // eslint-disable-next-line no-var
  var __slaApiApp: FastifyInstance | undefined;
}

type ApiMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

const ALLOWED_METHODS: ApiMethod[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];

const getRequestUrl = (req: VercelRequest): string => {
  let url = req.url || '/';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      url = `${parsed.pathname}${parsed.search}`;
    } catch {
      url = '/';
    }
  }

  return url.startsWith('/') ? url : `/${url}`;
};

const normalizeMethod = (value?: string): ApiMethod => {
  const upper = (value || 'GET').toUpperCase();
  return ALLOWED_METHODS.includes(upper as ApiMethod) ? (upper as ApiMethod) : 'GET';
};

const getApp = async (): Promise<FastifyInstance> => {
  if (global.__slaApiApp) {
    return global.__slaApiApp;
  }

  const { buildApp } = await import('../src/app');
  const app = await buildApp();
  await app.ready();
  global.__slaApiApp = app;
  return app;
};

const toInjectHeaders = (headers: VercelRequest['headers']): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return result;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    const url = getRequestUrl(req);
    const method = normalizeMethod(req.method);
    const headers = toInjectHeaders(req.headers);

    let payload: string | undefined;
    if (req.body && method !== 'GET' && method !== 'HEAD') {
      payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers['content-type'] = headers['content-type'] || 'application/json';
    }

    const response = await app.inject({
      method,
      url,
      headers,
      ...(payload ? { payload } : {}),
    });

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    res.end(response.body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('API handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : 'Unknown error',
        hint: 'Check Vercel env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, CORS_ORIGIN',
      });
    }
  }
}
