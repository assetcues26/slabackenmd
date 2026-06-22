import { FastifyInstance } from 'fastify';
import { config } from '../config';

const VALID_ROLES = ['admin', 'agent', 'viewer'];

type IdParam = { id: string };

const listUsersSql = `
  select
    u.id,
    u.email,
    u.created_at as "createdAt",
    u.last_sign_in_at as "lastSignInAt",
    u.email_confirmed_at as "emailConfirmedAt",
    u.banned_until as "bannedUntil",
    p.username,
    p.full_name as "fullName",
    coalesce(p.role, 'viewer') as role
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at asc
`;

export const adminRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/auth/resolve-login', async (request, reply) => {
    const { login } = (request.body ?? {}) as { login?: string };
    const value = login?.trim();
    if (!value) {
      reply.code(400).send({ error: 'Username or email is required' });
      return;
    }
    if (value.includes('@')) {
      return { email: value.toLowerCase() };
    }
    const result = await fastify.db.query(
      'select email from public.profiles where lower(username) = lower($1) limit 1',
      [value],
    );
    const email = result.rows[0]?.email;
    if (!email) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }
    return { email };
  });

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
    async () => {
      const result = await fastify.db.query(listUsersSql);
      const now = Date.now();
      const users = result.rows.map((row) => ({
        id: row.id,
        email: row.email ?? null,
        username: row.username ?? null,
        fullName: row.fullName ?? null,
        role: row.role ?? 'viewer',
        createdAt: row.createdAt ?? null,
        lastSignInAt: row.lastSignInAt ?? null,
        emailConfirmed: Boolean(row.emailConfirmedAt),
        banned: Boolean(row.bannedUntil && new Date(row.bannedUntil).getTime() > now),
      }));
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
      if (role === 'admin' && config.adminUsername) {
        const check = await fastify.db.query(
          'select username from profiles where id = $1',
          [id],
        );
        const username = check.rows[0]?.username?.toLowerCase();
        if (username !== config.adminUsername.toLowerCase()) {
          reply.code(403).send({ error: `Only ${config.adminUsername} can be admin.` });
          return;
        }
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
      const { id } = request.params as IdParam;
      const { password } = (request.body ?? {}) as { password?: string };
      const newPassword = password?.trim() || 'admin@2377';
      if (newPassword.length < 8) {
        reply.code(400).send({ error: 'Password must be at least 8 characters.' });
        return;
      }
      const updated = await fastify.db.query(
        `update auth.users
         set encrypted_password = crypt($2, gen_salt('bf')), updated_at = now()
         where id = $1
         returning email`,
        [id, newPassword],
      );
      if (!updated.rows.length) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      return { email: updated.rows[0].email, reset: true };
    },
  );

  fastify.post(
    '/admin/users/:id/ban',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as IdParam;
      const { banned } = (request.body ?? {}) as { banned?: boolean };
      if (id === request.authUser?.sub) {
        reply.code(400).send({ error: 'You cannot change access for your own account' });
        return;
      }
      await fastify.db.query(
        `update auth.users
         set banned_until = $2, updated_at = now()
         where id = $1`,
        [id, banned ? '2099-01-01T00:00:00Z' : null],
      );
      return { id, banned: Boolean(banned) };
    },
  );

  fastify.delete(
    '/admin/users/:id',
    { preHandler: [fastify.requireAuth, fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as IdParam;
      if (id === request.authUser?.sub) {
        reply.code(400).send({ error: 'You cannot delete your own account' });
        return;
      }
      const deleted = await fastify.db.query('delete from auth.users where id = $1 returning id', [
        id,
      ]);
      if (!deleted.rows.length) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      return { id, deleted: true };
    },
  );
};
