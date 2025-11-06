# Tibetan Translation Tool - Production Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (production + dev for build)
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Build the application
RUN npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:18-alpine AS runner
WORKDIR /app

# Install runtime dependencies
# - tesseract-ocr: OCR processing for Tibetan text
# - tesseract-ocr-data-bod: Tibetan language data for Tesseract
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-bod

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/db ./db
COPY --from=builder --chown=nodejs:nodejs /app/config ./config

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/cache /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 5439

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5439/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment variables
ENV NODE_ENV=production \
    PORT=5439

# Start the application
CMD ["node", "dist/index.js"]
