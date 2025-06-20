# -------- Build stage --------
FROM node:20-alpine AS build
WORKDIR /app

# Build argument for pnpm version
ARG PNPM_VERSION=9.1.0

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy .npmrc if it exists (for private registries)
COPY .npmrc* ./

# Install root dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build web-console (frontend) - dependencies already installed in workspace
WORKDIR /app/web-console
RUN NODE_ENV=development pnpm run build

# Build TypeScript server bundles
WORKDIR /app
RUN pnpm run build:server

# -------- Production stage --------
FROM node:20-alpine AS production
WORKDIR /app

# Build argument for pnpm version
ARG PNPM_VERSION=9.1.0

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy .npmrc if it exists (for private registries)
COPY .npmrc* ./

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled assets from build stage
COPY --from=build /app/web-console/dist ./web-console/dist
COPY --from=build /app/dist ./dist

# Copy only the pnpm store and node_modules for production
COPY --from=build /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
