import { FastifyRequest, FastifyReply } from 'fastify';
import { healthCheck } from '../config/database';

export async function healthHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const dbHealthy = await healthCheck();

  const status = dbHealthy ? 200 : 503;
  reply.status(status).send({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
}
