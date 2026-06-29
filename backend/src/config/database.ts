import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './env';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.max,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
});

// Configurar el search_path al esquema correcto en cada nueva conexión
pool.on('connect', (client: PoolClient) => {
  client.query(`SET search_path TO ${config.database.schema}, public`);
  console.log(`[DB] Client connected - schema: ${config.database.schema}`);
});

pool.on('error', (err: Error) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (duration > 100) {
    console.warn(`[DB] Slow query (${duration}ms):`, text);
  }

  return result;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Pool closed');
}

export default pool;
