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
