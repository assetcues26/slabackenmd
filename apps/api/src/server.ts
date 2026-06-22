import { buildApp } from './app';
import { config } from './config';

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
