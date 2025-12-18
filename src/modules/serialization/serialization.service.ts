import { logger } from "../../utils/logger";

export interface SerializationOptions {
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
  excludeFields?: string[];
  includeFields?: string[];
  transformFields?: Record<string, (value: any) => any>;
  maxDepth?: number;
}

export interface OptimizedSerializationResult {
  data: any;
  size: number;
  serialized: string;
  compressionRatio?: number;
}

export abstract class SerializationService {
  private static readonly MAX_DEPTH = 10;
  private static readonly DEFAULT_OPTIONS: SerializationOptions = {
    includeTimestamps: true,
    includeMetadata: false,
    maxDepth: 5,
  };

  /**
   * Optimize object serialization by removing unnecessary fields and transforming data
   */
  static optimizeObject<T>(obj: T, options: SerializationOptions = {}): T {
    const opts = { ...SerializationService.DEFAULT_OPTIONS, ...options };

    try {
      return SerializationService.transformObject(obj, opts, 0) as T;
    } catch (error) {
      logger.error("Error optimizing object serialization:", error);
      return obj; // Return original object if optimization fails
    }
  }

  /**
   * Transform object recursively
   */
  private static transformObject(obj: any, options: SerializationOptions, depth: number): any {
    if (depth >= (options.maxDepth || SerializationService.MAX_DEPTH)) {
      return "[Max Depth Reached]";
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "function") {
      return "[Function]";
    }

    if (obj instanceof Date) {
      return options.includeTimestamps ? obj.toISOString() : obj.getTime();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => SerializationService.transformObject(item, options, depth + 1));
    }

    if (typeof obj === "object") {
      const result: any = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip excluded fields
        if (options.excludeFields?.includes(key)) {
          continue;
        }

        // Include only specified fields if includeFields is provided
        if (options.includeFields && !options.includeFields.includes(key)) {
          continue;
        }

        // Apply field transformation if specified
        if (options.transformFields?.[key]) {
          result[key] = options.transformFields[key](value);
        } else {
          result[key] = SerializationService.transformObject(value, options, depth + 1);
        }
      }

      return result;
    }

    return obj;
  }

  /**
   * Serialize with size optimization
   */
  static serializeOptimized<T>(
    data: T,
    options: SerializationOptions = {}
  ): OptimizedSerializationResult {
    const startTime = Date.now();

    try {
      // Optimize the object first
      const optimizedData = SerializationService.optimizeObject(data, options);

      // Serialize to JSON
      const serialized = JSON.stringify(optimizedData);

      // Calculate sizes
      const originalSize = JSON.stringify(data).length;
      const optimizedSize = serialized.length;
      const compressionRatio = originalSize > 0 ? (1 - optimizedSize / originalSize) * 100 : 0;

      const result: OptimizedSerializationResult = {
        data: optimizedData,
        size: optimizedSize,
        serialized,
        compressionRatio,
      };

      const duration = Date.now() - startTime;
      logger.debug(
        `Serialization completed in ${duration}ms, size: ${optimizedSize} bytes, compression: ${compressionRatio.toFixed(2)}%`
      );

      return result;
    } catch (error) {
      logger.error("Error in optimized serialization:", error);
      // Fallback to standard serialization
      const serialized = JSON.stringify(data);
      return {
        data,
        size: serialized.length,
        serialized,
        compressionRatio: 0,
      };
    }
  }

  /**
   * Deserialize with error handling
   */
  static deserializeOptimized<T>(serialized: string, fallback?: T): T | null {
    try {
      return JSON.parse(serialized) as T;
    } catch (error) {
      logger.error("Error deserializing data:", error);
      return fallback || null;
    }
  }

  /**
   * Common serialization presets
   */
  static presets = {
    /**
     * Minimal serialization - only essential fields
     */
    minimal: {
      includeTimestamps: false,
      includeMetadata: false,
      excludeFields: ["createdAt", "updatedAt", "deletedAt", "metadata", "beforeData", "afterData"],
    },

    /**
     * API response serialization
     */
    apiResponse: {
      includeTimestamps: true,
      includeMetadata: false,
      excludeFields: ["deletedAt", "internalId", "secretKey"],
      transformFields: {
        createdAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        updatedAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
      },
    },

    /**
     * Audit trail serialization
     */
    auditTrail: {
      includeTimestamps: true,
      includeMetadata: true,
      excludeFields: ["deletedAt"],
      transformFields: {
        createdAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        beforeData: (value: any) => (typeof value === "string" ? JSON.parse(value) : value),
        afterData: (value: any) => (typeof value === "string" ? JSON.parse(value) : value),
        metadata: (value: any) => (typeof value === "string" ? JSON.parse(value) : value),
      },
    },

    /**
     * User profile serialization
     */
    userProfile: {
      includeTimestamps: true,
      includeMetadata: false,
      excludeFields: ["password", "secretKey", "internalNotes"],
      includeFields: [
        "id",
        "email",
        "firstName",
        "lastName",
        "phoneNumber",
        "createdAt",
        "updatedAt",
      ],
    },

    /**
     * Loan application serialization
     */
    loanApplication: {
      includeTimestamps: true,
      includeMetadata: false,
      excludeFields: ["deletedAt", "internalNotes"],
      transformFields: {
        createdAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        updatedAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        submittedAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        coApplicantIds: (value: any) => (typeof value === "string" ? JSON.parse(value) : value),
      },
    },

    /**
     * Document serialization
     */
    document: {
      includeTimestamps: true,
      includeMetadata: false,
      excludeFields: ["deletedAt", "docPassword"],
      transformFields: {
        createdAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
        updatedAt: (value: any) => (value instanceof Date ? value.toISOString() : value),
      },
    },
  };

  /**
   * Batch serialize multiple objects
   */
  static batchSerialize<T>(
    items: T[],
    options: SerializationOptions = {}
  ): OptimizedSerializationResult[] {
    const startTime = Date.now();

    try {
      const results = items.map((item) => SerializationService.serializeOptimized(item, options));

      const duration = Date.now() - startTime;
      const totalSize = results.reduce((sum, result) => sum + result.size, 0);
      const avgCompression =
        results.reduce((sum, result) => sum + (result.compressionRatio || 0), 0) / results.length;

      logger.debug(
        `Batch serialization completed in ${duration}ms, ${items.length} items, total size: ${totalSize} bytes, avg compression: ${avgCompression.toFixed(2)}%`
      );

      return results;
    } catch (error) {
      logger.error("Error in batch serialization:", error);
      return items.map((item) => ({
        data: item,
        size: JSON.stringify(item).length,
        serialized: JSON.stringify(item),
        compressionRatio: 0,
      }));
    }
  }

  /**
   * Create a serialization transformer for specific data types
   */
  static createTransformer<T>(options: SerializationOptions) {
    return {
      serialize: (data: T) => SerializationService.serializeOptimized(data, options),
      deserialize: (serialized: string) => SerializationService.deserializeOptimized<T>(serialized),
      optimize: (data: T) => SerializationService.optimizeObject(data, options),
    };
  }

  /**
   * Performance monitoring for serialization
   */
  static async measureSerializationPerformance<T>(
    data: T,
    options: SerializationOptions = {},
    iterations = 100
  ): Promise<{
    avgTime: number;
    avgSize: number;
    avgCompression: number;
    results: OptimizedSerializationResult[];
  }> {
    const results: OptimizedSerializationResult[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const result = SerializationService.serializeOptimized(data, options);
      const duration = Date.now() - startTime;

      results.push(result);
      times.push(duration);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const avgSize = results.reduce((sum, result) => sum + result.size, 0) / results.length;
    const avgCompression =
      results.reduce((sum, result) => sum + (result.compressionRatio || 0), 0) / results.length;

    return {
      avgTime,
      avgSize,
      avgCompression,
      results,
    };
  }
}
