# -------- Build stage --------
FROM node:20-alpine AS build
WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm ci --production=false

# Copy source code
COPY . .

# Build web-console (frontend)
WORKDIR /app/web-console
RUN NODE_ENV=development npm install && npm run build

# Build TypeScript server bundles
WORKDIR /app
RUN npm run build:server

# -------- Production stage --------
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled assets from build stage
COPY --from=build /app/web-console/dist ./web-console/dist
COPY --from=build /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
