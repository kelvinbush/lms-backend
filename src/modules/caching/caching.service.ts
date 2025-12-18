import { type RedisClientType, createClient } from "redis";
import { logger } from "../../utils/logger";

export abstract class CachingService {
  private static client: RedisClientType | null = null;
  private static defaultTTL = 5 * 60; // 5 minutes in seconds
  private static isConnected = false;

  /**
   * Initialize Redis connection
   */
  private static async initializeClient(): Promise<void> {
    if (CachingService.client && CachingService.isConnected) {
      return;
    }

    try {
      CachingService.client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis connection failed after 10 retries");
              return new Error("Redis connection failed");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      CachingService.client.on("error", (err) => {
        logger.error("Redis Client Error:", err);
        CachingService.isConnected = false;
      });

      CachingService.client.on("connect", () => {
        logger.info("Redis client connected");
        CachingService.isConnected = true;
      });

      CachingService.client.on("disconnect", () => {
        logger.warn("Redis client disconnected");
        CachingService.isConnected = false;
      });

      await CachingService.client.connect();
    } catch (error) {
      logger.error("Failed to initialize Redis client:", error);
      CachingService.isConnected = false;
      throw error;
    }
  }

  /**
   * Get Redis client instance
   */
  private static async getClient(): Promise<RedisClientType> {
    await CachingService.initializeClient();
    if (!CachingService.client || !CachingService.isConnected) {
      throw new Error("Redis client not available");
    }
    return CachingService.client;
  }

  /**
   * Set a value in the cache with optional TTL
   */
  static async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const client = await CachingService.getClient();
      const ttl = ttlSeconds || CachingService.defaultTTL;
      const serializedValue = JSON.stringify(value);

      await client.setEx(key, ttl, serializedValue);
      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the application
    }
  }

  /**
   * Get a value from the cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const client = await CachingService.getClient();
      const value = await client.get(key);

      if (value === null) {
        logger.debug(`Cache MISS: ${key}`);
        return null;
      }

      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      return null; // Return null on error - don't break the application
    }
  }

  /**
   * Delete a value from the cache
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const client = await CachingService.getClient();
      const result = await client.del(key);
      const deleted = result > 0;

      if (deleted) {
        logger.debug(`Cache DELETE: ${key}`);
      }
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  static async clear(): Promise<void> {
    try {
      const client = await CachingService.getClient();
      await client.flushAll();
      logger.debug("Cache CLEARED");
    } catch (error) {
      logger.error("Failed to clear cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    connected: boolean;
    info?: any;
    keys?: string[];
  }> {
    try {
      const client = await CachingService.getClient();
      const info = await client.info();
      const keys: string[] = [];
      let cursor = "0";

      // Use SCAN instead of KEYS to avoid permission issues
      do {
        const result = await client.scan(cursor, { MATCH: "*", COUNT: 100 });
        cursor = result.cursor;
        keys.push(...result.keys);
        if (keys.length >= 100) break; // Limit to first 100 keys
      } while (cursor !== "0");

      return {
        connected: CachingService.isConnected,
        info: CachingService.parseRedisInfo(info),
        keys: keys.slice(0, 100),
      };
    } catch (error) {
      logger.error("Failed to get cache stats:", error);
      return {
        connected: false,
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private static parseRedisInfo(info: string): any {
    const lines = info.split("\r\n");
    const result: any = {};

    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":");
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Clean up expired entries (Redis handles this automatically)
   */
  static async cleanup(): Promise<number> {
    // Redis automatically handles TTL expiration
    // This method is kept for compatibility but doesn't need to do anything
    logger.debug("Cache CLEANUP: Redis handles TTL expiration automatically");
    return 0;
  }

  /**
   * Cache key generators for common patterns
   */
  static generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  // Common cache key patterns
  static keys = {
    user: (userId: string) => this.generateKey("user", userId),
    loanApplication: (id: string) => this.generateKey("loan_application", id),
    loanApplicationSummary: (id: string) => this.generateKey("loan_application_summary", id),
    auditTrail: (loanApplicationId: string, params?: any) =>
      this.generateKey("audit_trail", loanApplicationId, JSON.stringify(params || {})),
    documentRequests: (loanApplicationId: string, params?: any) =>
      this.generateKey("document_requests", loanApplicationId, JSON.stringify(params || {})),
    snapshots: (loanApplicationId: string, params?: any) =>
      this.generateKey("snapshots", loanApplicationId, JSON.stringify(params || {})),
    documentStatistics: (loanApplicationId: string) =>
      this.generateKey("document_statistics", loanApplicationId),
    businessProfile: (businessId: string) => this.generateKey("business_profile", businessId),
    personalDocuments: (userId: string) => this.generateKey("personal_documents", userId),
    businessDocuments: (businessId: string) => this.generateKey("business_documents", businessId),
  };

  /**
   * Cache wrapper for async functions
   */
  static async withCache<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    // Try to get from cache first
    const cached = await CachingService.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const result = await fn();
    await CachingService.set(key, result, ttlSeconds);
    return result;
  }

  /**
   * Invalidate cache entries by pattern
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const client = await CachingService.getClient();
      const keys: string[] = [];
      let cursor = "0";

      // Use SCAN instead of KEYS to avoid permission issues
      do {
        const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== "0");

      if (keys.length > 0) {
        await client.del(keys);
        logger.debug(`Cache INVALIDATE PATTERN: ${pattern} (${keys.length} entries)`);
      }

      return keys.length;
    } catch (error) {
      logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate all cache entries for a loan application
   */
  static async invalidateLoanApplication(loanApplicationId: string): Promise<number> {
    const patterns = [
      CachingService.keys.loanApplication(loanApplicationId),
      CachingService.keys.loanApplicationSummary(loanApplicationId),
      CachingService.keys.auditTrail(loanApplicationId, ".*"),
      CachingService.keys.documentRequests(loanApplicationId, ".*"),
      CachingService.keys.snapshots(loanApplicationId, ".*"),
      CachingService.keys.documentStatistics(loanApplicationId),
    ];

    let totalInvalidated = 0;
    for (const pattern of patterns) {
      totalInvalidated += await CachingService.invalidatePattern(pattern);
    }

    return totalInvalidated;
  }

  /**
   * Invalidate all cache entries for a user
   */
  static async invalidateUser(userId: string): Promise<number> {
    const patterns = [
      CachingService.keys.user(userId),
      CachingService.keys.personalDocuments(userId),
    ];

    let totalInvalidated = 0;
    for (const pattern of patterns) {
      totalInvalidated += await CachingService.invalidatePattern(pattern);
    }

    return totalInvalidated;
  }

  /**
   * Invalidate all cache entries for a business
   */
  static async invalidateBusiness(businessId: string): Promise<number> {
    const patterns = [
      CachingService.keys.businessProfile(businessId),
      CachingService.keys.businessDocuments(businessId),
    ];

    let totalInvalidated = 0;
    for (const pattern of patterns) {
      totalInvalidated += await CachingService.invalidatePattern(pattern);
    }

    return totalInvalidated;
  }

  /**
   * Gracefully close Redis connection
   */
  static async close(): Promise<void> {
    if (CachingService.client && CachingService.isConnected) {
      try {
        await CachingService.client.quit();
        CachingService.isConnected = false;
        logger.info("Redis client disconnected gracefully");
      } catch (error) {
        logger.error("Error closing Redis client:", error);
      }
    }
  }
}
