# Simplified Dockerfile for Render deployment
FROM node:20-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (needed for build)
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Make build script executable
RUN chmod +x scripts/simple-build.js

# Build the application using simple build script
RUN node scripts/simple-build.js

# Verify the build worked
RUN ls -la dist/ && test -f dist/index.js || exit 1

# Remove dev dependencies after build
RUN npm prune --production

# Create necessary directories
RUN mkdir -p logs

# Use PORT from environment
ENV PORT=${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port (Render will override)
EXPOSE ${PORT}

# Start the application
CMD ["node", "dist/index.js"]