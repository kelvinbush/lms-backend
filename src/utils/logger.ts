import pino from "pino";

const pinoLogger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

// Helper function to normalize log data
const normalizeLogData = (data: any): object | undefined => {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (typeof data === "string") {
    return { message: data };
  }

  if (typeof data === "object") {
    return data;
  }

  // For other primitive types, wrap them
  return { data };
};

// Enhanced logger wrapper
export const logger = {
  info: (message: string, data?: any) => {
    const normalizedData = normalizeLogData(data);
    if (normalizedData) {
      pinoLogger.info(normalizedData, message);
    } else {
      pinoLogger.info(message);
    }
  },

  warn: (message: string, data?: any) => {
    const normalizedData = normalizeLogData(data);
    if (normalizedData) {
      pinoLogger.warn(normalizedData, message);
    } else {
      pinoLogger.warn(message);
    }
  },

  error: (message: string, data?: any) => {
    const normalizedData = normalizeLogData(data);
    if (normalizedData) {
      pinoLogger.error(normalizedData, message);
    } else {
      pinoLogger.error(message);
    }
  },

  debug: (message: string, data?: any) => {
    const normalizedData = normalizeLogData(data);
    if (normalizedData) {
      pinoLogger.debug(normalizedData, message);
    } else {
      pinoLogger.debug(message);
    }
  },
};
