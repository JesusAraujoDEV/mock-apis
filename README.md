# 🚀 Mock Engine - Motor de Mocks Dinámico y Autogestionado

Reemplazo completo de entornos estáticos (Mockoon) por un motor dinámico donde los endpoints se gestionan directamente desde PostgreSQL.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        Traefik (Dokploy)                     │
│                      ${MOCK_DOMAIN}                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Backend (Fastify)    │
                │   Catch-All Router     │
                │   Puerto: 3000         │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   PostgreSQL 16        │
                │   Tabla: endpoints     │
                └───────────────────────┘
```

## Estructura del Monorepo

```
mock-apis/
├── backend/
│   ├── Dockerfile              # Multi-stage build
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .dockerignore
│   └── src/
│       ├── server.ts           # Entry point Fastify
│       ├── config/
│       │   ├── env.ts          # Variables de entorno tipadas
│       │   └── database.ts     # Pool de conexiones pg
│       ├── handlers/
│       │   ├── catchall.handler.ts  # Ruta comodín (*)
│       │   └── health.handler.ts    # /_system/health
│       ├── services/
│       │   └── endpoint.service.ts  # Lógica de matching
│       └── db/
│           └── init.sql        # Schema + seeds
├── frontend/
│   ├── Dockerfile
│   └── public/
│       └── index.html          # Placeholder
├── docker-compose.yml          # Orquestación con labels Traefik
├── .gitignore
└── README.md
```

## Inicio Rápido

### 1. Clonar y configurar

```bash
cp backend/.env.example backend/.env
# Editar variables de entorno según tu entorno
```

### 2. Levantar con Docker Compose

```bash
# Crear la red de Dokploy si no existe
docker network create dokploy-network

# Levantar todos los servicios
docker compose up -d
```

### 3. Verificar

```bash
curl http://localhost:3000/_system/health
curl http://localhost:3000/api/v1/usuarios
curl http://localhost:3000/api/v1/usuarios/abc-123
```

## Cómo Funciona

1. **Request entrante** → Fastify lo captura con la ruta catch-all (`*`)
2. **Match exacto** → Busca en BD un registro con `path` y `method` idénticos
3. **Match parametrizado** → Si no hay exacto, busca rutas con `:param` y evalúa con `path-to-regexp`
4. **Respuesta** → Devuelve `response_body` con el `status_code` y `Content-Type` configurados
5. **404** → Si no hay match, responde JSON estandarizado

### Parámetros Dinámicos

Registra en BD una ruta como `/api/v1/usuarios/:id`, y en el `response_body` usa `{{id}}`:

```json
{
  "path": "/api/v1/usuarios/:id",
  "method": "GET",
  "response_body": {"id": "{{id}}", "nombre": "Mock User"}
}
```

Al hacer `GET /api/v1/usuarios/abc-123`, la respuesta será:

```json
{"id": "abc-123", "nombre": "Mock User"}
```

## Endpoints de Sistema

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/_system/health` | GET | Health check (BD + server) |
| `/_system/cache/clear` | POST | Invalidar cache de matchers |

## Deploy en Dokploy

1. Conectar el repositorio en Dokploy
2. Configurar variables de entorno (BD externa o el compose incluido)
3. Asegurarse que la red `dokploy-network` existe
4. Configurar el dominio en `MOCK_DOMAIN`
5. Dokploy + Traefik manejan SSL automáticamente via Let's Encrypt

## Gestión de Endpoints

Mientras no exista el panel de control, los endpoints se gestionan directamente en PostgreSQL:

```sql
-- Agregar nuevo endpoint
INSERT INTO endpoints (path, method, response_type, response_body, status_code)
VALUES ('/api/v1/productos', 'GET', 'application/json',
        '[{"id": 1, "nombre": "Producto A"}]'::jsonb, 200);

-- Desactivar un endpoint
UPDATE endpoints SET is_active = false WHERE path = '/api/v1/old-route';

-- Listar todos los endpoints activos
SELECT path, method, status_code, description FROM endpoints WHERE is_active = true;
```

Después de modificar endpoints, invalida el cache:

```bash
curl -X POST http://localhost:3000/_system/cache/clear
```

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | 3000 | Puerto del servidor |
| `DB_HOST` | localhost | Host de PostgreSQL |
| `DB_PORT` | 5432 | Puerto de PostgreSQL |
| `DB_USER` | mock_user | Usuario de BD |
| `DB_PASSWORD` | mock_secret_password | Contraseña de BD |
| `DB_NAME` | mock_engine | Nombre de la base de datos |
| `DB_POOL_MAX` | 20 | Conexiones máximas en el pool |
| `LOG_LEVEL` | info | Nivel de log (debug, info, warn, error) |
| `MOCK_DOMAIN` | — | Dominio público para Traefik |
