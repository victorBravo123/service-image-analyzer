import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Logger } from '../../../domain/ports/logger';
import '../dto/request-context';

const UNLOGGED_PATHS: ReadonlySet<string> = new Set(['/api/health']);

export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const urlService = req.originalUrl;
    if (UNLOGGED_PATHS.has(req.path)) {
      next();
      return;
    }

    const idTransaction = randomUUID();
    const startTime = Date.now();
    req.idTransaction = idTransaction;
    req.startTime = startTime;

    const event = `${req.method} ${urlService}`;

    logger.info({
      IdTransaction: idTransaction,
      urlService,
      action: 'start-request',
      event,
      method: req.method,
      responseTime: 0,
      status: 'ok',
      code: '0',
      message: describeRequest(req),
    });

    res.on('finish', () => {
      logger.info({
        IdTransaction: idTransaction,
        urlService,
        action: 'end-request',
        event,
        method: req.method,
        responseTime: Date.now() - startTime,
        status: res.statusCode,
        code: '0',
        message: `Response: ${res.statusCode}`,
      });
    });

    next();
  };
}

function describeRequest(req: Request): string {
  const parts: string[] = [];

  if (Object.keys(req.query).length > 0) {
    parts.push(`Query: ${JSON.stringify(req.query)}`);
  }

  const contentType = req.headers['content-type']?.split(';')[0];
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > 0) {
    const size = formatBytes(contentLength);
    parts.push(contentType ? `Payload: ${size} (${contentType})` : `Payload: ${size}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No request data';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
