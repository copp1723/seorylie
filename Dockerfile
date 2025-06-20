# Multi-stage build for Node.js application
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web-console/package*.json ./web-console/
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --frozen-lockfile

# Copy source files
COPY web-console/ ./web-console/
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/

# Build the web console
RUN cd web-console && npm ci && npm run build

# Build the server
RUN npm run build:server

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --frozen-lockfile && npm cache clean --force

# Copy built assets and server
COPY --from=build /app/web-console/dist ./web-console/dist
COPY --from=build /app/dist ./dist
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Copy necessary root files
COPY setup-db.js .
COPY setup-ga4-credentials.js .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]