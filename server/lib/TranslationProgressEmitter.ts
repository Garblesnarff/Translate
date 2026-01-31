/**
 * Translation Progress Emitter
 *
 * Handles Server-Sent Events for real-time translation progress updates.
 * Captures and streams console output to clients during translation processes.
 *
 * @author Translation Service Team
 */

import { Response } from 'express';

/**
 * Progress emitter for Server-Sent Events with log capture
 */
export class TranslationProgressEmitter {
  private res: Response;
  private closed = false;
  private originalConsole: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };

  constructor(response: Response) {
    this.res = response;

    // Store original console methods
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // Start capturing console output
    this.captureConsole();
  }

  private captureConsole() {
    const createLogCapture = (level: 'info' | 'warn' | 'error' | 'debug', originalMethod: (...args: any[]) => void) => {
      return (...args: any[]) => {
        // Call original console method
        originalMethod.apply(console, args);

        // Stream log to client if SSE is active
        if (!this.closed) {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');

          // Extract source from log message if available
          let source = '';
          const sourceMatch = message.match(/^\[([^\]]+)\]/);
          if (sourceMatch) {
            source = sourceMatch[1];
          }

          this.emit('log', {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            level,
            message: message.replace(/^\[[^\]]+\]\s*/, ''), // Remove [Source] prefix
            source
          });
        }
      };
    };

    // Override console methods
    console.log = createLogCapture('info', this.originalConsole.log);
    console.info = createLogCapture('info', this.originalConsole.info);
    console.warn = createLogCapture('warn', this.originalConsole.warn);
    console.error = createLogCapture('error', this.originalConsole.error);
  }

  private restoreConsole() {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
  }

  emit(event: string, data: any) {
    if (this.closed) return;

    try {
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.originalConsole.error('Error writing SSE data:', error);
      this.closed = true;
    }
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.restoreConsole(); // Restore console when closing

      try {
        this.res.write('event: close\n');
        this.res.write('data: {}\n\n');
        this.res.end();
      } catch (error) {
        this.originalConsole.error('Error closing SSE connection:', error);
      }
    }
  }
}
