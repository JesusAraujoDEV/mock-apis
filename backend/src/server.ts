import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { config } from './config/env';
import { closePool } from './config/database';
import { catchAllHandler } from './handlers/catchall.handler';
import { healthHandler } from './handlers/health.handler';
import { clearMatcherCache } from './services/endpoint.service';
import {
  listEndpoints,
  getEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  testEndpoint,
} from './handlers/crud.handler';

const fastify = Fastify({
  logger: {
    level: config.log.level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
});

// --- CORS para desarrollo local ---
fastify.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    reply.status(204).send();
  }
});

// --- Frontend estático en /_panel ---
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/_panel/',
});

// Redirect raíz del panel
fastify.get('/_panel', async (_request, reply) => {
  reply.redirect('/_panel/');
});

// --- Rutas de sistema ---
fastify.get('/_system/health', healthHandler);

fastify.post('/_system/cache/clear', async (_request, reply) => {
  clearMatcherCache();
  reply.send({ message: 'Matcher cache cleared', timestamp: new Date().toISOString() });
});

// --- CRUD de endpoints ---
fastify.get('/_system/endpoints', listEndpoints);
fastify.get('/_system/endpoints/:id', getEndpoint);
fastify.post('/_system/endpoints', createEndpoint);
fastify.put('/_system/endpoints/:id', updateEndpoint);
fastify.delete('/_system/endpoints/:id', deleteEndpoint);
fastify.post('/_system/endpoints/:id/test', testEndpoint);

// --- Catch-all: intercepta TODO lo que no sea /_system ---
fastify.all('*', catchAllHandler);

// --- Graceful Shutdown ---
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
  await fastify.close();
  await closePool();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Arranque ---
async function start(): Promise<void> {
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    fastify.log.info(
      `Mock Engine running on http://${config.server.host}:${config.server.port}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
