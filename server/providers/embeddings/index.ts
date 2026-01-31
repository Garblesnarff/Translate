/**
 * Embedding Providers - Barrel Export
 *
 * Exports all embedding provider implementations.
 *
 * @module server/providers/embeddings
 */

export { GeminiEmbeddingProvider, type GeminiEmbeddingConfig } from './GeminiEmbeddingProvider.js';
export { OpenAIEmbeddingProvider, type OpenAIEmbeddingConfig } from './OpenAIEmbeddingProvider.js';
export { LocalEmbeddingProvider, type LocalEmbeddingConfig } from './LocalEmbeddingProvider.js';
