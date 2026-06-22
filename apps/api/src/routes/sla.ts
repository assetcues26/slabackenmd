import { FastifyInstance } from 'fastify';
import { slaConfig, statusMetaByStatus } from '@jira-sla/shared';

export const slaRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/sla/statuses', async () => {
    return {
      config: slaConfig,
      statusMeta: statusMetaByStatus,
    };
  });
};
