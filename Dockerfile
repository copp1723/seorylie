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
