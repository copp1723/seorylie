# Multi-stage build for Node.js application
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web-console/package*.json ./web-console/

# Install dependencies
RUN npm ci --frozen-lockfile

# Copy web-console source
COPY web-console/ ./web-console/

# Build the web console
RUN cd web-console && npm ci && npm run build

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --frozen-lockfile && npm cache clean --force

# Copy built assets and server
COPY --from=build /app/web-console/dist ./web-console/dist
COPY server.js .
COPY setup-db.js .
COPY setup-ga4-credentials.js .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]