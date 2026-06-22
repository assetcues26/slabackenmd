import { FastifyInstance } from 'fastify';

export const healthRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });
};
