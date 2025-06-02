# Base stage for common dependencies
FROM node:20-alpine AS base
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

# Build stage
FROM base AS build
WORKDIR /app

# Install all dependencies for building
RUN npm ci

# Copy source files needed for build
COPY --chown=appuser:appgroup server ./server
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup database ./database
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup client ./client
COPY --chown=appuser:appgroup assets ./assets
COPY --chown=appuser:appgroup config ./config

# Build the application
RUN npm run build

# Production stage for deployment
FROM base AS production
WORKDIR /app

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built files and runtime dependencies
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/database ./database
COPY --chown=appuser:appgroup migrations ./migrations

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
