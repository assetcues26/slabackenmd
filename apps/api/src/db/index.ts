import { Pool } from 'pg';
import fp from 'fastify-plugin';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

export const dbPlugin = fp(async (fastify) => {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: process.env.VERCEL ? 1 : 10,
    ssl: config.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async (instance) => {
    await instance.db.end();
  });
});
