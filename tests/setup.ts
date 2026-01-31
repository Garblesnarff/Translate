import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test case
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY_ODD = 'test-key-odd';
process.env.GEMINI_API_KEY_EVEN = 'test-key-even';

// Suppress console errors in tests unless explicitly testing error handling
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render') ||
      args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};
