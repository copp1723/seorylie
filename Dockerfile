<<<<<<< HEAD
# Base stage for common dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Copy package files for dependency installation
COPY --chown=appuser:appgroup package*.json ./

# Server stage
FROM base AS server
WORKDIR /app

# Install all dependencies
RUN npm ci

# Copy server source code
COPY --chown=appuser:appgroup server ./server
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup drizzle.config.ts ./
COPY --chown=appuser:appgroup migrations ./migrations
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup tsconfig.json ./

# Expose server port
EXPOSE 3000

# Start server
CMD ["npm", "run", "dev"]

# Client stage
FROM base AS client
WORKDIR /app

# Install all dependencies
RUN npm ci

# Copy client source code and shared code
COPY --chown=appuser:appgroup client ./client
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup assets ./assets
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup vite.config.ts ./

# Expose client port
EXPOSE 5173

# Set working directory to client for running Vite
WORKDIR /app

# Start client using Vite directly
CMD ["npx", "vite", "--host", "0.0.0.0", "client"]
=======
# Dockerfile for vin-agent service
# Multi-stage build for better efficiency and security

# Build stage
FROM node:18-alpine AS build

# Install dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    py3-pip \
    build-base \
    curl

# Set working directory
WORKDIR /app

# Copy package files for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Install Playwright browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy from build stage
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package*.json ./
COPY --from=build --chown=appuser:appgroup /app/client ./client
COPY --from=build --chown=appuser:appgroup /app/server ./server
COPY --from=build --chown=appuser:appgroup /app/scripts ./scripts
COPY --from=build --chown=appuser:appgroup /app/shared ./shared
COPY --from=build --chown=appuser:appgroup /app/migrations ./migrations
COPY --from=build --chown=appuser:appgroup /app/tsconfig.json ./
COPY --from=build --chown=appuser:appgroup /app/.env.example ./.env.example
COPY --from=build --chown=appuser:appgroup /ms-playwright /ms-playwright

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose port
EXPOSE 5000

# Switch to non-root user
USER appuser

# Set command to run the dev server
CMD ["npm", "run", "dev"]
>>>>>>> f4f9c01f2e9364c76fa0867836193ea7318b3b60
