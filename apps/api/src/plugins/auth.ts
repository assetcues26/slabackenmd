import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
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
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

let jwks: JWTVerifyGetKey | null | undefined;

const getJwks = (): JWTVerifyGetKey | null => {
  if (jwks !== undefined) {
    return jwks;
  }

  jwks = null;
  if (!config.supabaseUrl) {
    return jwks;
  }

  try {
    const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', `${config.supabaseUrl}/`);
    jwks = createRemoteJWKSet(jwksUrl);
  } catch {
    jwks = null;
  }

  return jwks;
};

const verifyToken = async (token: string) => {
  const issuer = config.supabaseUrl ? `${config.supabaseUrl}/auth/v1` : undefined;

  const verifyOptions = {
    issuer,
    audience: 'authenticated',
  };

  const keySet = getJwks();
  if (keySet) {
    try {
      const { payload } = await jwtVerify(token, keySet, verifyOptions);
      return payload;
    } catch {
      // Fall through to legacy HS256 secret if configured
    }
  }

  if (config.supabaseJwtSecret) {
    const key = new TextEncoder().encode(config.supabaseJwtSecret);
    const { payload } = await jwtVerify(token, key, verifyOptions);
    return payload;
  }

  if (keySet) {
    const { payload } = await jwtVerify(token, keySet, verifyOptions);
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
    } catch {
      reply.code(401).send({ error: 'Invalid or expired token' });
      return;
    }
  });

  fastify.decorate('requireAdmin', async (request, reply) => {
    const userId = request.authUser?.sub;
    if (!userId) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    const result = await fastify.db.query('select role from profiles where id = $1', [userId]);
    const role = result.rows[0]?.role;
    if (role !== 'admin') {
      reply.code(403).send({ error: 'Admin access required' });
      return;
    }
  });
});
