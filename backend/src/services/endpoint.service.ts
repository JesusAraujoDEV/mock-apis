import { query } from '../config/database';
import { match, MatchFunction } from 'path-to-regexp';

export interface Endpoint {
  id: string;
  path: string;
  method: string;
  response_type: string;
  response_body: unknown;
  status_code: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MatchedEndpoint {
  endpoint: Endpoint;
  params: Record<string, string>;
}

// Cache de funciones de matching compiladas para evitar recompilación en cada request
const matcherCache = new Map<string, MatchFunction<Record<string, string>>>();

function getMatcher(pattern: string): MatchFunction<Record<string, string>> {
  let matcher = matcherCache.get(pattern);
  if (!matcher) {
    matcher = match<Record<string, string>>(pattern, { decode: decodeURIComponent });
    matcherCache.set(pattern, matcher);
  }
  return matcher;
}

/**
 * Busca un endpoint que coincida exactamente con el path y método dados.
 * Primero intenta un match exacto (más rápido), luego prueba rutas parametrizadas.
 */
export async function findMatchingEndpoint(
  requestPath: string,
  requestMethod: string
): Promise<MatchedEndpoint | null> {
  const method = requestMethod.toUpperCase();

  // 1. Intentar match exacto (la mayoría de los casos)
  const exactResult = await query<Endpoint>(
    `SELECT id, path, method, response_type, response_body, status_code, is_active
     FROM endpoints
     WHERE path = $1 AND method = $2 AND is_active = true
     LIMIT 1`,
    [requestPath, method]
  );

  if (exactResult.rows.length > 0) {
    return { endpoint: exactResult.rows[0], params: {} };
  }

  // 2. Buscar rutas parametrizadas (contienen ':') para el mismo método
  const paramResult = await query<Endpoint>(
    `SELECT id, path, method, response_type, response_body, status_code, is_active
     FROM endpoints
     WHERE method = $1 AND is_active = true AND path LIKE '%:%'
     ORDER BY path DESC`,
    [method]
  );

  // 3. Evaluar cada ruta parametrizada contra el request path
  for (const row of paramResult.rows) {
    const matcher = getMatcher(row.path);
    const matched = matcher(requestPath);

    if (matched) {
      return {
        endpoint: row,
        params: matched.params as Record<string, string>,
      };
    }
  }

  return null;
}

/**
 * Invalida el cache de matchers (útil al modificar endpoints).
 */
export function clearMatcherCache(): void {
  matcherCache.clear();
}
