-- ============================================================
-- Motor de Mocks Dinámico - Schema PostgreSQL
-- Esquema configurado via variable DB_SCHEMA
-- ============================================================

-- Crear el esquema si no existe
CREATE SCHEMA IF NOT EXISTS mockapis;

-- Trabajar dentro del esquema mockapis
SET search_path TO mockapis, public;

-- Extensión para generación de UUIDs (se crea en public)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- ============================================================
-- TABLA: mockapis.endpoints
-- Almacena la configuración de cada endpoint mock.
-- ============================================================
CREATE TABLE IF NOT EXISTS mockapis.endpoints (
    id              UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    
    -- Ruta del endpoint (soporta parámetros con ':' ej. /api/usuarios/:id)
    path            VARCHAR(512) NOT NULL,
    
    -- Método HTTP (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
    method          VARCHAR(10) NOT NULL,
    
    -- Content-Type de la respuesta (application/json, text/csv, text/xml, etc.)
    response_type   VARCHAR(100) NOT NULL DEFAULT 'application/json',
    
    -- Cuerpo de la respuesta. JSONB para respuestas JSON, TEXT para otros formatos.
    response_body   JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Campo de texto para respuestas no-JSON (CSV, XML, HTML, texto plano)
    response_body_raw TEXT,
    
    -- Código de estado HTTP de la respuesta
    status_code     INT NOT NULL DEFAULT 200,
    
    -- Activación/desactivación sin eliminar el registro
    is_active       BOOLEAN NOT NULL DEFAULT true,
    
    -- Descripción opcional para documentación interna
    description     TEXT,
    
    -- Timestamps automáticos
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ============================================================
    -- RESTRICCIONES
    -- ============================================================
    
    -- Validar que el método sea uno de los métodos HTTP estándar
    CONSTRAINT chk_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
    
    -- Validar que el status_code esté en rango válido
    CONSTRAINT chk_status_code CHECK (status_code BETWEEN 100 AND 599),
    
    -- El path debe comenzar con /
    CONSTRAINT chk_path_format CHECK (path ~ '^/')
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Índice único compuesto: previene rutas duplicadas con el mismo método
CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoints_path_method_unique
    ON mockapis.endpoints (path, method);

-- Índice parcial optimizado para búsquedas del catch-all (solo endpoints activos)
CREATE INDEX IF NOT EXISTS idx_endpoints_active_lookup
    ON mockapis.endpoints (path, method)
    INCLUDE (id, response_type, response_body, status_code)
    WHERE is_active = true;

-- Índice para búsqueda de rutas parametrizadas (contienen ':')
CREATE INDEX IF NOT EXISTS idx_endpoints_parameterized
    ON mockapis.endpoints (method)
    INCLUDE (id, path, response_type, response_body, status_code)
    WHERE is_active = true AND path LIKE '%:%';

-- ============================================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION mockapis.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_endpoints_updated_at ON mockapis.endpoints;

CREATE TRIGGER trg_endpoints_updated_at
    BEFORE UPDATE ON mockapis.endpoints
    FOR EACH ROW
    EXECUTE FUNCTION mockapis.update_updated_at_column();

-- ============================================================
-- DATOS DE EJEMPLO (Seeds)
-- ============================================================

INSERT INTO mockapis.endpoints (path, method, response_type, response_body, status_code, description)
VALUES
    -- Endpoint estático simple
    ('/api/v1/health', 'GET', 'application/json',
     '{"status": "ok", "service": "mock-engine", "version": "1.0.0"}'::jsonb,
     200, 'Health check del servicio mock'),

    -- Lista de usuarios
    ('/api/v1/usuarios', 'GET', 'application/json',
     '[{"id": "usr-001", "nombre": "Juan Pérez", "email": "juan@example.com"}, {"id": "usr-002", "nombre": "María García", "email": "maria@example.com"}]'::jsonb,
     200, 'Lista de usuarios mock'),

    -- Endpoint parametrizado: detalle de usuario
    ('/api/v1/usuarios/:id', 'GET', 'application/json',
     '{"id": "{{id}}", "nombre": "Usuario Mock", "email": "mock@example.com", "activo": true}'::jsonb,
     200, 'Detalle de usuario por ID (parametrizado)'),

    -- Endpoint POST: creación de usuario
    ('/api/v1/usuarios', 'POST', 'application/json',
     '{"message": "Usuario creado exitosamente", "id": "usr-new-001"}'::jsonb,
     201, 'Creación de usuario mock'),

    -- Endpoint con error simulado
    ('/api/v1/error-example', 'GET', 'application/json',
     '{"error": "SERVICE_UNAVAILABLE", "message": "El servicio no está disponible temporalmente"}'::jsonb,
     503, 'Ejemplo de error simulado')
ON CONFLICT (path, method) DO NOTHING;
