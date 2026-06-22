import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { dbPlugin } from './db';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';
import { slaRoutes } from './routes/sla';
import { ticketRoutes } from './routes/tickets';
import { notificationRoutes } from './routes/notifications';
import { statusHistoryRoutes } from './routes/status-history';
import { statsRoutes } from './routes/stats';

export const buildApp = async () => {
  const app = Fastify({ logger: !process.env.VERCEL });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });
  await app.register(helmet);
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Jira SLA API',
        version: '0.1.0',
      },
      servers: [{ url: config.publicUrl }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(dbPlugin);
  await app.register(authPlugin);

  app.register(healthRoutes, { prefix: '/v1' });
  app.register(slaRoutes, { prefix: '/v1' });
  app.register(ticketRoutes, { prefix: '/v1' });
  app.register(statsRoutes, { prefix: '/v1' });
  app.register(statusHistoryRoutes, { prefix: '/v1' });
  app.register(notificationRoutes, { prefix: '/v1' });

  return app;
};
