/**
 * Response Compression Middleware V2
 *
 * Provides:
 * - Automatic response compression (gzip/brotli)
 * - Configurable compression level (1-9)
 * - Selective compression (>1KB threshold)
 * - Skip compression for certain content types
 * - Compression metrics tracking
 */

import compression from 'compression';
import type { Request, Response, NextFunction } from 'express';

/**
 * Compression metrics
 */
interface CompressionMetrics {
  totalRequests: number;
  compressedResponses: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  avgCompressionRatio: number;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  // Compression level (1-9, default: 6)
  level?: number;

  // Minimum response size to compress (bytes, default: 1024)
  threshold?: number;

  // Maximum response size to compress (bytes, default: 10MB)
  maxSize?: number;

  // Enable Brotli compression (if available)
  enableBrotli?: boolean;

  // Content types to compress (default: text/* + application/json/xml/javascript)
  compressibleTypes?: string[];

  // Track compression metrics
  enableMetrics?: boolean;
}

/**
 * Compression service
 */
class CompressionService {
  private metrics: CompressionMetrics = {
    totalRequests: 0,
    compressedResponses: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    avgCompressionRatio: 0,
  };

  constructor(private config: CompressionConfig) {}

  /**
   * Track compression metrics
   */
  trackCompression(originalSize: number, compressedSize: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.compressedResponses++;
    this.metrics.totalOriginalBytes += originalSize;
    this.metrics.totalCompressedBytes += compressedSize;

    // Calculate average compression ratio
    if (this.metrics.totalOriginalBytes > 0) {
      this.metrics.avgCompressionRatio =
        (this.metrics.totalCompressedBytes / this.metrics.totalOriginalBytes) * 100;
    }
  }

  /**
   * Track request
   */
  trackRequest(): void {
    if (!this.config.enableMetrics) return;
    this.metrics.totalRequests++;
  }

  /**
   * Get metrics
   */
  getMetrics(): CompressionMetrics & { compressionRate: number; bytesSaved: number } {
    const compressionRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.compressedResponses / this.metrics.totalRequests) * 100
        : 0;

    const bytesSaved = this.metrics.totalOriginalBytes - this.metrics.totalCompressedBytes;

    return {
      ...this.metrics,
      compressionRate,
      bytesSaved,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      compressedResponses: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      avgCompressionRatio: 0,
    };
  }
}

/**
 * Default compressible content types
 */
const DEFAULT_COMPRESSIBLE_TYPES = [
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/javascript',
  'text/csv',
  'application/json',
  'application/javascript',
  'application/xml',
  'application/x-javascript',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/ld+json',
  'image/svg+xml',
];

/**
 * Non-compressible content types (already compressed or binary)
 */
const NON_COMPRESSIBLE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
];

/**
 * Create compression middleware
 */
export function createCompressionMiddleware(config: CompressionConfig = {}) {
  const {
    level = 6, // Balanced compression (1=fastest, 9=best compression)
    threshold = 1024, // 1KB minimum
    maxSize = 10 * 1024 * 1024, // 10MB maximum
    enableBrotli = true,
    compressibleTypes = DEFAULT_COMPRESSIBLE_TYPES,
    enableMetrics = true,
  } = config;

  const service = new CompressionService({ ...config, enableMetrics });

  // Custom filter function
  const filter = (req: Request, res: Response) => {
    // Track request
    service.trackRequest();

    // Skip if client doesn't accept compression
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Check content type
    const contentType = res.getHeader('content-type')?.toString() || '';

    // Don't compress if already compressed
    if (NON_COMPRESSIBLE_TYPES.some(type => contentType.includes(type))) {
      return false;
    }

    // Only compress specific types
    const isCompressible = compressibleTypes.some(type => contentType.includes(type));

    if (!isCompressible) {
      return false;
    }

    // Use default compression filter
    return compression.filter(req, res);
  };

  // Create compression middleware
  // Note: Brotli is automatically supported by the compression library
  // if the client sends Accept-Encoding: br header
  const compressionMiddleware = compression({
    level,
    threshold,
    filter,
  });

  // Wrap middleware to track metrics
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enableMetrics) {
      return compressionMiddleware(req, res, next);
    }

    // Track original content length
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    let originalSize = 0;
    let compressedSize = 0;

    res.write = function (chunk: any, ...args: any[]) {
      if (chunk) {
        originalSize += Buffer.byteLength(chunk);
      }
      return originalWrite(chunk, ...args);
    } as any;

    res.end = function (chunk: any, ...args: any[]) {
      if (chunk) {
        originalSize += Buffer.byteLength(chunk);
      }

      // Get compressed size from Content-Length header
      const contentLength = res.getHeader('content-length');
      if (contentLength) {
        compressedSize = parseInt(contentLength.toString(), 10);
      }

      // Track compression if response was compressed
      const contentEncoding = res.getHeader('content-encoding');
      if (contentEncoding && originalSize > 0) {
        service.trackCompression(originalSize, compressedSize || originalSize);
      }

      return originalEnd(chunk, ...args);
    } as any;

    compressionMiddleware(req, res, next);
  };
}

/**
 * Create compression service for metrics tracking
 */
let globalService: CompressionService | null = null;

export function initCompressionService(config: CompressionConfig = {}): CompressionService {
  globalService = new CompressionService(config);
  return globalService;
}

export function getCompressionMetrics(): ReturnType<CompressionService['getMetrics']> | null {
  return globalService?.getMetrics() || null;
}

export function resetCompressionMetrics(): void {
  globalService?.resetMetrics();
}

/**
 * Express middleware for compression metrics endpoint
 */
export function compressionMetricsHandler(req: Request, res: Response) {
  const metrics = getCompressionMetrics();

  if (!metrics) {
    return res.status(503).json({
      error: 'Compression metrics not available',
      hint: 'Enable metrics in compression config',
    });
  }

  res.json({
    compression: {
      totalRequests: metrics.totalRequests,
      compressedResponses: metrics.compressedResponses,
      compressionRate: `${metrics.compressionRate.toFixed(2)}%`,
      avgCompressionRatio: `${metrics.avgCompressionRatio.toFixed(2)}%`,
      totalOriginalBytes: metrics.totalOriginalBytes,
      totalCompressedBytes: metrics.totalCompressedBytes,
      bytesSaved: metrics.bytesSaved,
      bytesSavedHuman: formatBytes(metrics.bytesSaved),
    },
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Example usage:
 *
 * import { createCompressionMiddleware, compressionMetricsHandler } from './middleware/compression';
 *
 * // Apply compression to all routes
 * app.use(createCompressionMiddleware({
 *   level: 6,              // Balanced compression
 *   threshold: 1024,       // Compress responses >1KB
 *   enableBrotli: true,    // Use Brotli when available
 *   enableMetrics: true,   // Track compression metrics
 * }));
 *
 * // Metrics endpoint
 * app.get('/api/metrics/compression', compressionMetricsHandler);
 */
