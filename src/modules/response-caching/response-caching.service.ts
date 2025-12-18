import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../utils/logger";
import { CachingService } from "../caching/caching.service";

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  keyGenerator?: (request: FastifyRequest) => string;
  skipCache?: (request: FastifyRequest) => boolean;
  vary?: string[]; // Headers that affect cache key
  tags?: string[]; // Cache tags for invalidation
}

export interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  payload: any;
  timestamp: number;
  ttl: number;
}

export abstract class ResponseCachingService {
  private static defaultTTL = 5 * 60; // 5 minutes in seconds
  private static cachePrefix = "response_cache";

  /**
   * Generate cache key for a request
   */
  private static generateCacheKey(request: FastifyRequest, options: CacheOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    const { method, url } = request;
    const query = request.query ? JSON.stringify(request.query) : "";
    const params = request.params ? JSON.stringify(request.params) : "";

    // Include vary headers in cache key
    let varyKey = "";
    if (options.vary) {
      const varyHeaders = options.vary
        .map((header) => `${header}:${request.headers[header] || ""}`)
        .join("|");
      varyKey = `|vary:${varyHeaders}`;
    }

    return `${ResponseCachingService.cachePrefix}:${method}:${url}:${query}:${params}${varyKey}`;
  }

  /**
   * Check if request should skip caching
   */
  private static shouldSkipCache(request: FastifyRequest, options: CacheOptions): boolean {
    // Skip cache for non-GET requests by default
    if (request.method !== "GET") {
      return true;
    }

    // Skip cache if custom skip function returns true
    if (options.skipCache?.(request)) {
      return true;
    }

    // Skip cache for requests with no-cache header
    if (request.headers["cache-control"]?.includes("no-cache")) {
      return true;
    }

    return false;
  }

  /**
   * Get cached response
   */
  static async getCachedResponse(
    request: FastifyRequest,
    options: CacheOptions = {}
  ): Promise<CachedResponse | null> {
    try {
      if (ResponseCachingService.shouldSkipCache(request, options)) {
        return null;
      }

      const cacheKey = ResponseCachingService.generateCacheKey(request, options);
      const cached = await CachingService.get<CachedResponse>(cacheKey);

      if (cached) {
        // Check if cache is still valid
        const now = Date.now();
        const expiresAt = cached.timestamp + cached.ttl * 1000;

        if (now < expiresAt) {
          logger.debug(`Response cache HIT: ${cacheKey}`);
          return cached;
        }
        // Cache expired, remove it
        await CachingService.delete(cacheKey);
        logger.debug(`Response cache EXPIRED: ${cacheKey}`);
      }

      logger.debug(`Response cache MISS: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error("Error getting cached response:", error);
      return null; // Don't break the request if caching fails
    }
  }

  /**
   * Cache response
   */
  static async cacheResponse(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      if (ResponseCachingService.shouldSkipCache(request, options)) {
        return;
      }

      const cacheKey = ResponseCachingService.generateCacheKey(request, options);
      const ttl = options.ttl || ResponseCachingService.defaultTTL;

      const cachedResponse: CachedResponse = {
        statusCode: reply.statusCode,
        headers: reply.getHeaders() as Record<string, string>,
        payload,
        timestamp: Date.now(),
        ttl,
      };

      await CachingService.set(cacheKey, cachedResponse, ttl);
      logger.debug(`Response cached: ${cacheKey} (TTL: ${ttl}s)`);

      // Add cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        const tagKey = `${cacheKey}:tags`;
        await CachingService.set(tagKey, options.tags, ttl);
      }
    } catch (error) {
      logger.error("Error caching response:", error);
      // Don't throw - caching failures shouldn't break the response
    }
  }

  /**
   * Invalidate cache by tags
   */
  static async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let invalidated = 0;

      for (const _tag of tags) {
        const pattern = `${ResponseCachingService.cachePrefix}:*:tags`;
        // This is a simplified approach - in production, you might want to use Redis sets for tags
        const keys = await CachingService.invalidatePattern(pattern);
        invalidated += keys;
      }

      logger.debug(`Invalidated ${invalidated} cache entries by tags: ${tags.join(", ")}`);
      return invalidated;
    } catch (error) {
      logger.error("Error invalidating cache by tags:", error);
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = `${ResponseCachingService.cachePrefix}:${pattern}`;
      const invalidated = await CachingService.invalidatePattern(fullPattern);

      logger.debug(`Invalidated ${invalidated} cache entries by pattern: ${pattern}`);
      return invalidated;
    } catch (error) {
      logger.error("Error invalidating cache by pattern:", error);
      return 0;
    }
  }

  /**
   * Clear all response cache
   */
  static async clearAll(): Promise<void> {
    try {
      await ResponseCachingService.invalidateByPattern("*");
      logger.debug("Cleared all response cache");
    } catch (error) {
      logger.error("Error clearing response cache:", error);
    }
  }

  /**
   * Fastify plugin for response caching
   */
  static createPlugin() {
    return async function responseCachingPlugin(fastify: any) {
      // Add response caching decorator
      fastify.decorate("responseCache", ResponseCachingService);

      // Add preHandler hook for cache retrieval
      fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
        const cacheOptions = (request as any).cacheOptions;
        if (!cacheOptions) return;

        const cached = await ResponseCachingService.getCachedResponse(request, cacheOptions);
        if (cached) {
          reply.code(cached.statusCode);
          Object.entries(cached.headers).forEach(([key, value]) => {
            reply.header(key, value);
          });
          reply.header("X-Cache", "HIT");
          reply.send(cached.payload);
          return;
        }
      });

      // Add onSend hook for cache storage
      fastify.addHook(
        "onSend",
        async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
          const cacheOptions = (request as any).cacheOptions;
          if (!cacheOptions) return payload;

          await ResponseCachingService.cacheResponse(request, reply, payload, cacheOptions);
          reply.header("X-Cache", "MISS");
          return payload;
        }
      );
    };
  }

  /**
   * Common cache key generators
   */
  static keyGenerators = {
    /**
     * Generate cache key for loan application endpoints
     */
    loanApplication: (request: FastifyRequest) => {
      const { method, url } = request;
      const params = request.params as any;
      const query = request.query as any;

      let key = `${ResponseCachingService.cachePrefix}:loan_app:${method}:${url}`;

      if (params?.id) {
        key += `:id:${params.id}`;
      }

      if (query?.status) {
        key += `:status:${query.status}`;
      }

      if (query?.limit) {
        key += `:limit:${query.limit}`;
      }

      if (query?.offset) {
        key += `:offset:${query.offset}`;
      }

      return key;
    },

    /**
     * Generate cache key for user-specific endpoints
     */
    userSpecific: (request: FastifyRequest) => {
      const { method, url } = request;
      const user = (request as any).user;
      const userId = user?.id || "anonymous";

      return `${ResponseCachingService.cachePrefix}:user:${userId}:${method}:${url}`;
    },

    /**
     * Generate cache key for business-specific endpoints
     */
    businessSpecific: (request: FastifyRequest) => {
      const { method, url } = request;
      const params = request.params as any;
      const businessId = params?.businessId || "unknown";

      return `${ResponseCachingService.cachePrefix}:business:${businessId}:${method}:${url}`;
    },
  };

  /**
   * Common cache options
   */
  static cacheOptions = {
    /**
     * Short-term cache (1 minute)
     */
    short: { ttl: 60 },

    /**
     * Medium-term cache (5 minutes)
     */
    medium: { ttl: 5 * 60 },

    /**
     * Long-term cache (30 minutes)
     */
    long: { ttl: 30 * 60 },

    /**
     * User-specific cache
     */
    userSpecific: {
      ttl: 5 * 60,
      keyGenerator: ResponseCachingService.keyGenerators.userSpecific,
      vary: ["authorization"],
    },

    /**
     * Loan application cache
     */
    loanApplication: {
      ttl: 2 * 60,
      keyGenerator: ResponseCachingService.keyGenerators.loanApplication,
      tags: ["loan_applications"],
    },

    /**
     * Business-specific cache
     */
    businessSpecific: {
      ttl: 5 * 60,
      keyGenerator: ResponseCachingService.keyGenerators.businessSpecific,
      tags: ["businesses"],
    },
  };
}
