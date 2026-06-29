import { FastifyRequest, FastifyReply } from 'fastify';
import { findMatchingEndpoint } from '../services/endpoint.service';

interface NotFoundResponse {
  error: string;
  message: string;
  path: string;
  method: string;
  timestamp: string;
}

function buildNotFoundResponse(path: string, method: string): NotFoundResponse {
  return {
    error: 'NOT_FOUND',
    message: `No mock endpoint configured for ${method} ${path}`,
    path,
    method,
    timestamp: new Date().toISOString(),
  };
}

export async function catchAllHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestPath = request.url.split('?')[0]; // Ignorar query params para el matching
  const requestMethod = request.method;

  try {
    const result = await findMatchingEndpoint(requestPath, requestMethod);

    if (!result) {
      reply
        .status(404)
        .header('Content-Type', 'application/json')
        .send(buildNotFoundResponse(requestPath, requestMethod));
      return;
    }

    const { endpoint, params } = result;

    // Preparar el body de respuesta
    let responseBody = endpoint.response_body;

    // Si hay parámetros dinámicos, inyectarlos en la respuesta JSON
    if (Object.keys(params).length > 0 && typeof responseBody === 'object' && responseBody !== null) {
      let bodyStr = JSON.stringify(responseBody);
      for (const [key, value] of Object.entries(params)) {
        bodyStr = bodyStr.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      responseBody = JSON.parse(bodyStr);
    }

    reply
      .status(endpoint.status_code)
      .header('Content-Type', endpoint.response_type)
      .header('X-Mock-Endpoint-Id', endpoint.id)
      .header('X-Mock-Matched-Path', endpoint.path)
      .send(responseBody);
  } catch (error) {
    const err = error as Error;
    request.log.error({ err, path: requestPath, method: requestMethod }, 'Error processing mock request');

    reply
      .status(500)
      .header('Content-Type', 'application/json')
      .send({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the mock request',
        timestamp: new Date().toISOString(),
      });
  }
}
