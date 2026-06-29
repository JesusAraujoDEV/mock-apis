# ============================================================
# Stage 1: Build (compilación TypeScript)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias primero (cache de layers Docker)
COPY package.json package-lock.json* ./

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci --ignore-scripts

# Copiar código fuente
COPY tsconfig.json ./
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Eliminar devDependencies después de compilar
RUN npm prune --production

# ============================================================
# Stage 2: Production (imagen ligera)
# ============================================================
FROM node:20-alpine AS production

LABEL maintainer="mock-engine-team"
LABEL description="Mock Engine Backend - Dynamic API Mocking Server"

# Seguridad: crear usuario no-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copiar solo lo necesario desde el builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Copiar script SQL de inicialización
COPY --chown=appuser:appgroup src/db/init.sql ./db/init.sql

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Ejecutar
CMD ["node", "dist/server.js"]
