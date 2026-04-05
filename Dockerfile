# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache postgresql-client

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

USER nodejs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
