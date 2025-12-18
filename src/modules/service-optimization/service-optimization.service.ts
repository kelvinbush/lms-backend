import { logger } from "../../utils/logger";
import { CachingService } from "../caching/caching.service";
import { SerializationService } from "../serialization/serialization.service";

export interface OptimizationOptions {
  enableCaching?: boolean;
  cacheTTL?: number;
  enableSerializationOptimization?: boolean;
  serializationPreset?: keyof typeof SerializationService.presets;
  enableParallelExecution?: boolean;
  enableBatchProcessing?: boolean;
  batchSize?: number;
  enablePerformanceMonitoring?: boolean;
}

export interface PerformanceMetrics {
  executionTime: number;
  cacheHit: boolean;
  serializationTime: number;
  dataSize: number;
  compressionRatio: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface OptimizedResult<T> {
  data: T;
  metrics: PerformanceMetrics;
  cached: boolean;
}

export abstract class ServiceOptimizationService {
  private static readonly DEFAULT_OPTIONS: OptimizationOptions = {
    enableCaching: true,
    cacheTTL: 5 * 60, // 5 minutes
    enableSerializationOptimization: true,
    serializationPreset: "apiResponse",
    enableParallelExecution: true,
    enableBatchProcessing: false,
    batchSize: 100,
    enablePerformanceMonitoring: false,
  };

  /**
   * Optimize a service method with caching, serialization, and performance monitoring
   */
  static async optimizeMethod<T>(
    methodName: string,
    method: () => Promise<T>,
    cacheKey: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizedResult<T>> {
    const opts = { ...ServiceOptimizationService.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    let cacheHit = false;
    let serializationTime = 0;
    let dataSize = 0;
    let compressionRatio = 0;

    try {
      // Try to get from cache first
      if (opts.enableCaching) {
        const cached = await CachingService.get<T>(cacheKey);
        if (cached !== null) {
          cacheHit = true;
          const executionTime = Date.now() - startTime;

          return {
            data: cached,
            metrics: {
              executionTime,
              cacheHit: true,
              serializationTime: 0,
              dataSize: JSON.stringify(cached).length,
              compressionRatio: 0,
            },
            cached: true,
          };
        }
      }

      // Execute the method
      const result = await method();

      // Optimize serialization if enabled
      let optimizedResult = result;
      if (opts.enableSerializationOptimization) {
        const serializationStart = Date.now();
        const serializationResult = SerializationService.serializeOptimized(
          result,
          SerializationService.presets[opts.serializationPreset!]
        );
        serializationTime = Date.now() - serializationStart;
        dataSize = serializationResult.size;
        compressionRatio = serializationResult.compressionRatio || 0;
        optimizedResult = serializationResult.data;
      } else {
        dataSize = JSON.stringify(result).length;
      }

      // Cache the result
      if (opts.enableCaching) {
        await CachingService.set(cacheKey, optimizedResult, opts.cacheTTL);
      }

      const executionTime = Date.now() - startTime;

      // Log performance metrics if enabled
      if (opts.enablePerformanceMonitoring) {
        logger.info(
          `Service method ${methodName} completed in ${executionTime}ms, cache: ${cacheHit ? "HIT" : "MISS"}, size: ${dataSize} bytes`
        );
      }

      return {
        data: optimizedResult,
        metrics: {
          executionTime,
          cacheHit: false,
          serializationTime,
          dataSize,
          compressionRatio,
          memoryUsage: process.memoryUsage(),
        },
        cached: false,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Service method ${methodName} failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimize batch processing
   */
  static async optimizeBatchMethod<T, R>(
    methodName: string,
    items: T[],
    batchProcessor: (batch: T[]) => Promise<R[]>,
    cacheKeyGenerator: (item: T) => string,
    options: OptimizationOptions = {}
  ): Promise<OptimizedResult<R[]>> {
    const opts = { ...ServiceOptimizationService.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    const batchSize = opts.batchSize || 100;
    const results: R[] = [];
    let cacheHits = 0;
    let _cacheMisses = 0;

    try {
      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        if (opts.enableCaching) {
          // Check cache for each item in batch
          const cachePromises = batch.map(async (item) => {
            const cacheKey = cacheKeyGenerator(item);
            const cached = await CachingService.get<R>(cacheKey);
            if (cached !== null) {
              cacheHits++;
              return { item, result: cached, cached: true };
            }
            _cacheMisses++;
            return { item, result: null, cached: false };
          });

          const cacheResults = await Promise.all(cachePromises);
          const cachedResults = cacheResults
            .filter((r) => r.cached && r.result !== null)
            .map((r) => r.result as R);
          const uncachedItems = cacheResults.filter((r) => !r.cached).map((r) => r.item);

          results.push(...cachedResults);

          // Process uncached items
          if (uncachedItems.length > 0) {
            const batchResults = await batchProcessor(uncachedItems);

            // Cache the results
            const cachePromises = uncachedItems.map(async (item, index) => {
              const cacheKey = cacheKeyGenerator(item);
              const result = batchResults[index];
              await CachingService.set(cacheKey, result, opts.cacheTTL);
            });

            await Promise.all(cachePromises);
            results.push(...batchResults);
          }
        } else {
          // No caching, process all items
          const batchResults = await batchProcessor(batch);
          results.push(...batchResults);
        }
      }

      const executionTime = Date.now() - startTime;
      const totalItems = items.length;
      const cacheHitRatio = totalItems > 0 ? (cacheHits / totalItems) * 100 : 0;

      if (opts.enablePerformanceMonitoring) {
        logger.info(
          `Batch method ${methodName} completed in ${executionTime}ms, processed ${totalItems} items, cache hit ratio: ${cacheHitRatio.toFixed(2)}%`
        );
      }

      return {
        data: results,
        metrics: {
          executionTime,
          cacheHit: cacheHits > 0,
          serializationTime: 0,
          dataSize: JSON.stringify(results).length,
          compressionRatio: 0,
        },
        cached: cacheHits > 0,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Batch method ${methodName} failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimize parallel execution
   */
  static async optimizeParallelMethod<T, R>(
    methodName: string,
    items: T[],
    processor: (item: T) => Promise<R>,
    options: OptimizationOptions = {}
  ): Promise<OptimizedResult<R[]>> {
    const opts = { ...ServiceOptimizationService.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    try {
      let results: R[];

      if (opts.enableParallelExecution) {
        // Execute all items in parallel
        const promises = items.map((item) => processor(item));
        results = await Promise.all(promises);
      } else {
        // Execute items sequentially
        results = [];
        for (const item of items) {
          const result = await processor(item);
          results.push(result);
        }
      }

      const executionTime = Date.now() - startTime;

      if (opts.enablePerformanceMonitoring) {
        logger.info(
          `Parallel method ${methodName} completed in ${executionTime}ms, processed ${items.length} items`
        );
      }

      return {
        data: results,
        metrics: {
          executionTime,
          cacheHit: false,
          serializationTime: 0,
          dataSize: JSON.stringify(results).length,
          compressionRatio: 0,
        },
        cached: false,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Parallel method ${methodName} failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Create an optimized service method wrapper
   */
  static createOptimizedMethod<T extends any[], R>(
    methodName: string,
    method: (...args: T) => Promise<R>,
    cacheKeyGenerator: (...args: T) => string,
    options: OptimizationOptions = {}
  ) {
    return async (...args: T): Promise<OptimizedResult<R>> => {
      const cacheKey = cacheKeyGenerator(...args);
      return ServiceOptimizationService.optimizeMethod(
        methodName,
        () => method(...args),
        cacheKey,
        options
      );
    };
  }

  /**
   * Performance monitoring utilities
   */
  static performance = {
    /**
     * Measure execution time
     */
    measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> => {
      const start = Date.now();
      const result = await fn();
      const time = Date.now() - start;
      return { result, time };
    },

    /**
     * Measure memory usage
     */
    measureMemory: (): NodeJS.MemoryUsage => {
      return process.memoryUsage();
    },

    /**
     * Create a performance monitor
     */
    createMonitor: (name: string) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      return {
        end: () => {
          const endTime = Date.now();
          const endMemory = process.memoryUsage();
          const executionTime = endTime - startTime;
          const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

          logger.info(
            `Performance monitor ${name}: ${executionTime}ms, memory delta: ${memoryDelta} bytes`
          );

          return {
            executionTime,
            memoryDelta,
            startMemory,
            endMemory,
          };
        },
      };
    },
  };

  /**
   * Common optimization presets
   */
  static presets = {
    /**
     * High performance - aggressive caching and optimization
     */
    highPerformance: {
      enableCaching: true,
      cacheTTL: 10 * 60, // 10 minutes
      enableSerializationOptimization: true,
      serializationPreset: "minimal" as const,
      enableParallelExecution: true,
      enableBatchProcessing: true,
      batchSize: 50,
      enablePerformanceMonitoring: true,
    },

    /**
     * Balanced - good performance with reasonable resource usage
     */
    balanced: {
      enableCaching: true,
      cacheTTL: 5 * 60, // 5 minutes
      enableSerializationOptimization: true,
      serializationPreset: "apiResponse" as const,
      enableParallelExecution: true,
      enableBatchProcessing: false,
      enablePerformanceMonitoring: false,
    },

    /**
     * Conservative - minimal optimization for stability
     */
    conservative: {
      enableCaching: true,
      cacheTTL: 2 * 60, // 2 minutes
      enableSerializationOptimization: false,
      enableParallelExecution: false,
      enableBatchProcessing: false,
      enablePerformanceMonitoring: false,
    },
  };
}
