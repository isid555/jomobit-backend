# Multi-stage Dockerfile for Node.js Application with Native Dependencies
# Stage 1: Build Stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (canvas, sharp, etc.)
# These are needed to compile native Node.js addons
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    librsvg-dev

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (production + dev for building native modules)
# Using npm ci for reproducible builds
RUN npm ci && npm cache clean --force

# Stage 2: Production Stage
FROM node:18-alpine

# Install runtime dependencies for native modules and dumb-init
RUN apk add --no-cache \
    dumb-init \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    librsvg

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
