import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

type AuthUser = {
  sub: string;
  email?: string;
  role?: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const jwks = config.supabaseUrl
  ? createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/keys`))
  : null;

const verifyToken = async (token: string) => {
  const issuer = config.supabaseUrl ? `${config.supabaseUrl}/auth/v1` : undefined;

  // Prefer JWKS (ES256) — current Supabase default. Legacy HS256 secret is fallback only.
  if (jwks) {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return payload;
  }

  if (config.supabaseJwtSecret) {
    const key = new TextEncoder().encode(config.supabaseJwtSecret);
    const { payload } = await jwtVerify(token, key, { issuer });
    return payload;
  }

  throw new Error('Supabase auth not configured');
};

export const authPlugin = fp(async (fastify) => {
  fastify.decorateRequest('authUser', undefined);

  fastify.decorate('requireAuth', async (request, reply) => {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      reply.code(401).send({ error: 'Missing bearer token' });
      return;
    }

    try {
      const payload = await verifyToken(token);
      request.authUser = {
        sub: String(payload.sub || ''),
        email: payload.email ? String(payload.email) : undefined,
        role: payload.role ? String(payload.role) : undefined,
      };
    } catch (err) {
      reply.code(401).send({ error: 'Invalid or expired token' });
      return;
    }
  });
});
