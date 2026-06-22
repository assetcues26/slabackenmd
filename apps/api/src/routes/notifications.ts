import { FastifyInstance } from 'fastify';

type TokenBody = {
  deviceToken: string;
  platform?: string;
};

export const notificationRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/notifications/device-tokens', { preHandler: fastify.requireAuth }, async (request) => {
    const body = request.body as TokenBody;

    if (!body?.deviceToken) {
      return { error: 'deviceToken is required' };
    }

    await fastify.db.query(
      `
      insert into device_tokens (user_id, device_token, platform)
      values ($1, $2, $3)
      on conflict (device_token)
      do update set user_id = excluded.user_id, platform = excluded.platform
      `,
      [request.authUser?.sub || 'unknown', body.deviceToken, body.platform || null],
    );

    return { ok: true };
  });

  fastify.get('/notifications/device-tokens', { preHandler: fastify.requireAuth }, async (request) => {
    const result = await fastify.db.query(
      'select device_token, platform, created_at from device_tokens where user_id = $1 order by created_at desc',
      [request.authUser?.sub || 'unknown'],
    );
    return { items: result.rows };
  });
};
