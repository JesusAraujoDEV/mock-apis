import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../config/database';
import { clearMatcherCache } from '../services/endpoint.service';

interface EndpointBody {
  path: string;
  method: string;
  response_type?: string;
  response_body: unknown;
  status_code?: number;
  is_active?: boolean;
  description?: string;
}

interface IdParam {
  id: string;
}

// GET /_system/endpoints - Listar todos
export async function listEndpoints(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = await query(
    `SELECT id, path, method, response_type, response_body, status_code, is_active, description, created_at, updated_at
     FROM endpoints ORDER BY path, method`
  );
  reply.send(result.rows);
}

// GET /_system/endpoints/:id - Obtener uno
export async function getEndpoint(
  request: FastifyRequest<{ Params: IdParam }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as IdParam;
  const result = await query(
    `SELECT id, path, method, response_type, response_body, status_code, is_active, description, created_at, updated_at
     FROM endpoints WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    reply.status(404).send({ error: 'Endpoint not found' });
    return;
  }

  reply.send(result.rows[0]);
}

// POST /_system/endpoints - Crear
export async function createEndpoint(
  request: FastifyRequest<{ Body: EndpointBody }>,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as EndpointBody;

  if (!body.path || !body.method) {
    reply.status(400).send({ error: 'path and method are required' });
    return;
  }

  try {
    const result = await query(
      `INSERT INTO endpoints (path, method, response_type, response_body, status_code, is_active, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, path, method, response_type, response_body, status_code, is_active, description, created_at, updated_at`,
      [
        body.path,
        body.method.toUpperCase(),
        body.response_type || 'application/json',
        JSON.stringify(body.response_body || {}),
        body.status_code || 200,
        body.is_active !== undefined ? body.is_active : true,
        body.description || null,
      ]
    );

    clearMatcherCache();
    reply.status(201).send(result.rows[0]);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      reply.status(409).send({ error: 'An endpoint with this path and method already exists' });
    } else {
      throw err;
    }
  }
}

// PUT /_system/endpoints/:id - Actualizar
export async function updateEndpoint(
  request: FastifyRequest<{ Params: IdParam; Body: EndpointBody }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as IdParam;
  const body = request.body as EndpointBody;

  try {
    const result = await query(
      `UPDATE endpoints
       SET path = COALESCE($1, path),
           method = COALESCE($2, method),
           response_type = COALESCE($3, response_type),
           response_body = COALESCE($4, response_body),
           status_code = COALESCE($5, status_code),
           is_active = COALESCE($6, is_active),
           description = COALESCE($7, description)
       WHERE id = $8
       RETURNING id, path, method, response_type, response_body, status_code, is_active, description, created_at, updated_at`,
      [
        body.path || null,
        body.method ? body.method.toUpperCase() : null,
        body.response_type || null,
        body.response_body ? JSON.stringify(body.response_body) : null,
        body.status_code || null,
        body.is_active !== undefined ? body.is_active : null,
        body.description !== undefined ? body.description : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'Endpoint not found' });
      return;
    }

    clearMatcherCache();
    reply.send(result.rows[0]);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      reply.status(409).send({ error: 'An endpoint with this path and method already exists' });
    } else {
      throw err;
    }
  }
}

// DELETE /_system/endpoints/:id - Eliminar
export async function deleteEndpoint(
  request: FastifyRequest<{ Params: IdParam }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as IdParam;
  const result = await query(
    'DELETE FROM endpoints WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    reply.status(404).send({ error: 'Endpoint not found' });
    return;
  }

  clearMatcherCache();
  reply.status(204).send();
}

// POST /_system/endpoints/:id/test - Probar un endpoint
export async function testEndpoint(
  request: FastifyRequest<{ Params: IdParam }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as IdParam;
  const result = await query(
    `SELECT path, method, response_type, response_body, status_code
     FROM endpoints WHERE id = $1 AND is_active = true`,
    [id]
  );

  if (result.rows.length === 0) {
    reply.status(404).send({ error: 'Endpoint not found or inactive' });
    return;
  }

  const ep = result.rows[0] as { path: string; method: string; response_type: string; response_body: unknown; status_code: number };
  reply.send({
    url: ep.path,
    method: ep.method,
    status_code: ep.status_code,
    content_type: ep.response_type,
    response_body: ep.response_body,
  });
}
