export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string; // e.g., 'TranslationService', 'MultiProviderAI', etc.
  data?: any; // Additional structured data
}

export interface LogViewerState {
  entries: LogEntry[];
  isExpanded: boolean;
  filter: LogLevel | 'all';
  maxEntries: number;
}

export type LogLevel = LogEntry['level'];

export const LOG_COLORS: Record<LogLevel, string> = {
  info: 'text-blue-600',
  warn: 'text-yellow-600', 
  error: 'text-red-600',
  debug: 'text-gray-500'
};

export const LOG_ICONS: Record<LogLevel, string> = {
  info: '🔍',
  warn: '⚠️',
  error: '❌',
  debug: '🐛'
};