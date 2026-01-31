/**
 * Manages multiple Gemini API keys with automatic rotation and rate limit handling
 */

export interface GeminiKeyInfo {
  key: string;
  status: 'available' | 'rate_limited' | 'disabled';
  resetTime?: number; // Timestamp when key becomes available again
  disabledReason?: string;
  callsToday: number;
  lastUsed?: number;
  displayName: string; // e.g., "Primary ODD", "Backup 1"
}

export interface KeyUsageStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  lastReset: Date;
}

export class GeminiKeyPool {
  private keys: GeminiKeyInfo[] = [];
  private currentIndex: number = 0;
  private usageStats: Map<string, KeyUsageStats> = new Map();
  private poolName: string;

  constructor(poolName: string, primaryKey: string, backupKeys: string[] = []) {
    this.poolName = poolName;
    
    // Add primary key
    if (primaryKey) {
      this.keys.push({
        key: primaryKey,
        status: 'available',
        callsToday: 0,
        displayName: `Primary ${poolName.toUpperCase()}`
      });
      this.initUsageStats(primaryKey);
    }

    // Add backup keys
    backupKeys.forEach((key, index) => {
      if (key) {
        this.keys.push({
          key,
          status: 'available', 
          callsToday: 0,
          displayName: `Backup ${index + 1}`
        });
        this.initUsageStats(key);
      }
    });

    console.log(`[GeminiKeyPool] Initialized ${poolName} pool with ${this.keys.length} keys`);
  }

  private initUsageStats(key: string): void {
    this.usageStats.set(key, {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgResponseTime: 0,
      lastReset: new Date()
    });
  }

  /**
   * Get the next available API key, with rotation
   */
  public getNextAvailableKey(): string | null {
    // First, check if any rate-limited keys can be re-enabled
    this.checkAndResetKeys();

    // Try to find an available key starting from current index
    const availableKeys = this.keys.filter(k => k.status === 'available');
    
    if (availableKeys.length === 0) {
      console.error(`[GeminiKeyPool] No available keys in ${this.poolName} pool`);
      return null;
    }

    // Reset index if it's out of bounds for the current available set
    if (this.currentIndex >= availableKeys.length) {
      this.currentIndex = 0;
    }

    // Simple round-robin rotation
    const key = availableKeys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
    
    key.lastUsed = Date.now();
    console.log(`[GeminiKeyPool] Using ${key.displayName} for ${this.poolName}`);
    
    return key.key;
  }

  /**
   * Mark a key as rate-limited with optional reset time
   */
  public markKeyAsRateLimited(apiKey: string, error?: any): void {
    const keyInfo = this.keys.find(k => k.key === apiKey);
    if (!keyInfo) return;

    keyInfo.status = 'rate_limited';
    
    // Try to extract reset time from error message
    let resetTime = Date.now() + 15 * 60 * 1000; // Default: 15 minutes
    
    if (error?.message) {
      const resetMatch = error.message.match(/Please try again in ([\d.]+)([hms])/);
      if (resetMatch) {
        const value = parseFloat(resetMatch[1]);
        const unit = resetMatch[2];
        const multiplier = unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000;
        resetTime = Date.now() + (value * multiplier);
      }
    }
    
    keyInfo.resetTime = resetTime;
    
    const resetTimeStr = new Date(resetTime).toLocaleTimeString();
    console.warn(`[GeminiKeyPool] ${keyInfo.displayName} rate limited until ${resetTimeStr}`);
    
    // Update stats
    const stats = this.usageStats.get(apiKey);
    if (stats) {
      stats.failedCalls++;
    }
  }

  /**
   * Mark a key as permanently disabled
   */
  public markKeyAsDisabled(apiKey: string, reason: string): void {
    const keyInfo = this.keys.find(k => k.key === apiKey);
    if (!keyInfo) return;

    keyInfo.status = 'disabled';
    keyInfo.disabledReason = reason;
    keyInfo.resetTime = undefined;
    
    console.error(`[GeminiKeyPool] ${keyInfo.displayName} disabled: ${reason}`);
  }

  /**
   * Record successful API call
   */
  public recordSuccessfulCall(apiKey: string, responseTime: number): void {
    const keyInfo = this.keys.find(k => k.key === apiKey);
    const stats = this.usageStats.get(apiKey);
    
    if (keyInfo) {
      keyInfo.callsToday++;
    }
    
    if (stats) {
      stats.totalCalls++;
      stats.successfulCalls++;
      // Running average
      stats.avgResponseTime = (stats.avgResponseTime * (stats.successfulCalls - 1) + responseTime) / stats.successfulCalls;
    }
  }

  /**
   * Check and reset rate-limited keys that have passed their reset time
   */
  private checkAndResetKeys(): void {
    const now = Date.now();
    
    this.keys.forEach(keyInfo => {
      if (keyInfo.status === 'rate_limited' && keyInfo.resetTime && now >= keyInfo.resetTime) {
        keyInfo.status = 'available';
        keyInfo.resetTime = undefined;
        console.log(`[GeminiKeyPool] ${keyInfo.displayName} is available again after rate limit reset`);
      }
    });
  }

  /**
   * Get pool status for monitoring/dashboard
   */
  public getPoolStatus(): {
    poolName: string;
    totalKeys: number;
    availableKeys: number;
    rateLimitedKeys: number;
    disabledKeys: number;
    keys: Array<{
      displayName: string;
      status: string;
      callsToday: number;
      resetIn?: string;
      disabledReason?: string;
    }>;
  } {
    const now = Date.now();
    
    return {
      poolName: this.poolName,
      totalKeys: this.keys.length,
      availableKeys: this.keys.filter(k => k.status === 'available').length,
      rateLimitedKeys: this.keys.filter(k => k.status === 'rate_limited').length,
      disabledKeys: this.keys.filter(k => k.status === 'disabled').length,
      keys: this.keys.map(keyInfo => ({
        displayName: keyInfo.displayName,
        status: keyInfo.status,
        callsToday: keyInfo.callsToday,
        resetIn: keyInfo.resetTime ? this.formatTimeRemaining(keyInfo.resetTime - now) : undefined,
        disabledReason: keyInfo.disabledReason
      }))
    };
  }

  private formatTimeRemaining(ms: number): string {
    if (ms <= 0) return '0s';
    
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Reset daily counters (call at midnight)
   */
  public resetDailyCounters(): void {
    this.keys.forEach(keyInfo => {
      keyInfo.callsToday = 0;
    });
    
    this.usageStats.forEach(stats => {
      stats.lastReset = new Date();
    });
    
    console.log(`[GeminiKeyPool] Reset daily counters for ${this.poolName} pool`);
  }
}