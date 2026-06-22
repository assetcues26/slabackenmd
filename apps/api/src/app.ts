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

const isVercel = Boolean(process.env.VERCEL);

const buildCorsAllowList = (): string[] => {
  const value = config.corsOrigin;
  return Array.isArray(value) ? value : [value];
};

const isOriginAllowed = (origin: string, allowList: string[]): boolean => {
  if (allowList.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
};

export const buildApp = async () => {
  const app = Fastify({ logger: !isVercel });

  const allowList = buildCorsAllowList();

  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser requests (curl, server-to-server) have no Origin header
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, isOriginAllowed(origin, allowList));
    },
    credentials: true,
  });

  await app.register(helmet, isVercel ? { contentSecurityPolicy: false } : undefined);

  if (!isVercel) {
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
  }

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
