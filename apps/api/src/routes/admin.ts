import { FastifyInstance } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let adminClient: SupabaseClient | null = null;

const getAdminClient = (): SupabaseClient | null => {
  if (adminClient) return adminClient;
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
};

const frontendBase = (): string => {
  const origin = Array.isArray(config.corsOrigin) ? config.corsOrigin[0] : config.corsOrigin;
  return (origin || '').replace(/\/+$/, '');
};

const VALID_ROLES = ['admin', 'agent', 'viewer'];

type IdParam = { id: string };

export const adminRoutes = async (fastify: FastifyInstance) => {
  // Current authenticated user's profile + role (used by the frontend to gate UI)
  fastify.get('/me', { preHandler: fastify.requireAuth }, async (request) => {
    const userId = request.authUser?.sub;
    const result = await fastify.db.query(
      'select id, email, username, full_name, role from profiles where id = $1',
      [userId],
    );
    const profile = result.rows[0] ?? null;
    return {
      id: userId,
      email: request.authUser?.email ?? profile?.email ?? null,
      role: profile?.role ?? 'viewer',
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? null,
    };
  });

  fastify.get(
    '/admin/users',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (_request, reply) => {
      const client = getAdminClient();
      if (!client) {
        reply.code(503).send({ error: 'Service role key not configured on the server' });
        return;
      }

      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        reply.code(502).send({ error: error.message });
        return;
      }

      const profilesRes = await fastify.db.query('select id, role, username, full_name from profiles');
      const roleMap = new Map(profilesRes.rows.map((r) => [r.id, r]));
      const now = Date.now();

      const users = data.users.map((u) => {
        const profile = roleMap.get(u.id);
        const bannedUntil = (u as { banned_until?: string }).banned_until;
        return {
          id: u.id,
          email: u.email ?? null,
          username: profile?.username ?? null,
          fullName: profile?.full_name ?? null,
          role: profile?.role ?? 'viewer',
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          emailConfirmed: Boolean(u.email_confirmed_at),
          banned: Boolean(bannedUntil && new Date(bannedUntil).getTime() > now),
        };
      });

      return { users };
    },
  );

  fastify.patch(
    '/admin/users/:id/role',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as IdParam;
      const { role } = (request.body ?? {}) as { role?: string };
      if (!role || !VALID_ROLES.includes(role)) {
        reply.code(400).send({ error: 'Invalid role. Use admin, agent, or viewer.' });
        return;
      }
      await fastify.db.query(
        `insert into profiles (id, role) values ($1, $2)
         on conflict (id) do update set role = excluded.role, updated_at = now()`,
        [id, role],
      );
      return { id, role };
    },
  );

  fastify.post(
    '/admin/users/:id/reset',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const client = getAdminClient();
      if (!client) {
        reply.code(503).send({ error: 'Service role key not configured on the server' });
        return;
      }
      const { id } = request.params as IdParam;
      const userRes = await fastify.db.query('select email from auth.users where id = $1', [id]);
      const email = userRes.rows[0]?.email;
      if (!email) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      const { data, error } = await client.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${frontendBase()}/reset-password` },
      });
      if (error) {
        reply.code(502).send({ error: error.message });
        return;
      }
      return { email, link: data.properties?.action_link ?? null };
    },
  );

  fastify.post(
    '/admin/users/:id/ban',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const client = getAdminClient();
      if (!client) {
        reply.code(503).send({ error: 'Service role key not configured on the server' });
        return;
      }
      const { id } = request.params as IdParam;
      const { banned } = (request.body ?? {}) as { banned?: boolean };
      if (id === request.authUser?.sub) {
        reply.code(400).send({ error: 'You cannot change access for your own account' });
        return;
      }
      const { error } = await client.auth.admin.updateUserById(id, {
        ban_duration: banned ? '876000h' : 'none',
      });
      if (error) {
        reply.code(502).send({ error: error.message });
        return;
      }
      return { id, banned: Boolean(banned) };
    },
  );

  fastify.delete(
    '/admin/users/:id',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const client = getAdminClient();
      if (!client) {
        reply.code(503).send({ error: 'Service role key not configured on the server' });
        return;
      }
      const { id } = request.params as IdParam;
      if (id === request.authUser?.sub) {
        reply.code(400).send({ error: 'You cannot delete your own account' });
        return;
      }
      const { error } = await client.auth.admin.deleteUser(id);
      if (error) {
        reply.code(502).send({ error: error.message });
        return;
      }
      return { id, deleted: true };
    },
  );
};
