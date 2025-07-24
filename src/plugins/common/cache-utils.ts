/**
 * Common Cache Utilities - Shared caching for all plugins
 */

/**
 * Simple in-memory cache with TTL support
 */
export class PluginCache<TKey, TValue> {
  private cache = new Map<TKey, CacheEntry<TValue>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  async get(key: TKey): Promise<TValue | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    return entry.value;
  }

  async set(key: TKey, value: TValue, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });
  }

  async has(key: TKey): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: TKey): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T extends TValue>(
    key: TKey, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const existing = await this.get(key);
    if (existing !== undefined) {
      return existing as T;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    const validEntries = entries.filter(entry => now <= entry.expiresAt);
    
    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries: entries.length - validEntries.length,
      oldestEntry: entries.reduce((oldest, entry) => 
        !oldest || entry.createdAt < oldest.createdAt ? entry : oldest, 
        null as CacheEntry<TValue> | null
      )?.createdAt,
      newestEntry: entries.reduce((newest, entry) => 
        !newest || entry.createdAt > newest.createdAt ? entry : newest, 
        null as CacheEntry<TValue> | null
      )?.createdAt
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  lastAccessed: number;
}

/**
 * File-based cache for persistent caching across runs
 */
export class FileCache {
  private filePath: string;
  private cache: Map<string, any> = new Map();
  private dirty = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    this.dirty = true;
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.dirty = true;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      const fs = await import('fs');
      const data = JSON.stringify(Object.fromEntries(this.cache), null, 2);
      await fs.promises.writeFile(this.filePath, data, 'utf-8');
      this.dirty = false;
    } catch (error) {
      console.warn(`Failed to save cache to ${this.filePath}:`, error);
    }
  }

  private async load(): Promise<void> {
    try {
      const fs = await import('fs');
      const data = await fs.promises.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache = new Map(Object.entries(parsed));
    } catch {
      // File doesn't exist or is invalid, start with empty cache
      this.cache = new Map();
    }
  }
}
