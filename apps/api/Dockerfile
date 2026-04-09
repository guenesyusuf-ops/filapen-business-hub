# ==============================================================================
# Filapen API -- Production Dockerfile
# Multi-stage build for minimal image size
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY apps/api/ ./apps/api/
COPY packages/database/ ./packages/database/
COPY packages/shared/ ./packages/shared/
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build the API
RUN cd apps/api && npm run build

# ==============================================================================
# Production image
# ==============================================================================

FROM node:20-alpine AS production

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only production node_modules and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
