# Base stage for common dependencies
FROM node:20-slim AS base

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a non-root user with home directory
RUN groupadd -r appgroup && useradd -r -g appgroup appuser -m -d /home/appuser
RUN mkdir -p /home/appuser/.npm && \
    chown -R appuser:appgroup /home/appuser && \
    chown -R appuser:appgroup /app

# Copy package files for dependency installation
COPY package*.json ./

# Server stage
FROM base AS server
WORKDIR /app

# Install all dependencies
RUN npm ci

# Copy server source code
COPY --chown=appuser:appgroup server ./server
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup database/schema/drizzle.config.ts ./drizzle.config.ts
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

# Testing stage for mock services and CI testing
FROM base AS testing
WORKDIR /app

# Install all dependencies including dev dependencies
RUN npm ci

# Copy all source code and test files
COPY --chown=appuser:appgroup server ./server
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup client ./client
COPY --chown=appuser:appgroup test ./test
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup migrations ./migrations
COPY --chown=appuser:appgroup database/schema/drizzle.config.ts ./drizzle.config.ts
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup config/build/jest.config.js ./jest.config.js
COPY --chown=appuser:appgroup .env.test ./.env

# Create directories for test results and artifacts
RUN mkdir -p test-results/jest test-results/fixtures test-results/adf-e2e

# Set environment variables for testing
ENV NODE_ENV=test
ENV USE_MOCKS=true
ENV TEST_MODE=true

# Default command runs all tests with mocks
CMD ["npm", "run", "test:ci"]

# Production stage for deployment
FROM base AS production
WORKDIR /app

# Install all dependencies first (needed for build)
RUN npm config set cache /tmp/.npm && \
    npm ci && \
    npm install @rollup/rollup-linux-x64-gnu --no-save && \
    chown -R appuser:appgroup /app

# Copy source files needed for build
COPY --chown=appuser:appgroup server ./server
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup database ./database
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup client ./client
COPY --chown=appuser:appgroup assets ./assets
COPY --chown=appuser:appgroup config ./config
COPY --chown=appuser:appgroup migrations ./migrations

# Switch to app user for build
USER appuser

# Build the application
RUN npm run build

# Switch back to root to prune dependencies and create directories
USER root
RUN npm prune --omit=dev && \
    mkdir -p logs && \
    chown -R appuser:appgroup /app

# Switch back to app user
USER appuser

# Set production environment and required variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV UV_THREADPOOL_SIZE=4
ENV DATABASE_URL=${DATABASE_URL:-postgresql://localhost:5432/cleanrylie}
ENV SESSION_SECRET=${SESSION_SECRET:-change-me-in-production}
ENV JWT_SECRET=${JWT_SECRET:-change-me-in-production}
ENV FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
ENV CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3000}

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
