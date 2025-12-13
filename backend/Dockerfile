# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Security: Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Memory optimization for 4GB server
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "src/server.js"]
