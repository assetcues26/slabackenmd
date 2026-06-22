import { FastifyInstance } from 'fastify';

export const statusHistoryRoutes = async (fastify: FastifyInstance) => {
  fastify.get(
    '/status-history/:ticketKey',
    { preHandler: fastify.requireAuth },
    async (request) => {
      const { ticketKey } = request.params as { ticketKey: string };
      const result = await fastify.db.query(
        'select * from status_history where ticket_key = $1 order by updated_time desc',
        [ticketKey],
      );

      return { items: result.rows };
    },
  );
};
