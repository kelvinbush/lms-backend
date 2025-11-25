/**
 * Shared utilities for Admin SME service
 */

// Lightweight HTTP error helper compatible with our route error handling
export function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

