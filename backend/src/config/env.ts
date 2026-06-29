import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    host: requireEnv('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    schema: process.env.DB_SCHEMA || 'public',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
