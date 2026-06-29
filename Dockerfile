# ============================================================
# Stage 1: Build Backend (TypeScript)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY backend/tsconfig.json ./
COPY backend/src/ ./src/

RUN npm run build
RUN npm prune --production

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:20-alpine AS production

LABEL maintainer="mock-engine"
LABEL description="Mock Engine - Dynamic API Mocking Server"

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Backend compilado
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Frontend estático
COPY --chown=appuser:appgroup frontend/public ./public

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/_system/health || exit 1

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/server.js"]
