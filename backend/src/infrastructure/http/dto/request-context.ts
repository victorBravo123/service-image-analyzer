/**
 * Per-request correlation data, attached by the request logger so that the
 * start, the end and any failure of one request share a single id.
 */
declare module 'express-serve-static-core' {
  interface Request {
    idTransaction?: string;
    startTime?: number;
  }
}

export {};
