import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../../../domain/ports/logger';
import '../dto/request-context';

/** Health checks would drown the useful signal, so they are not logged. */
const UNLOGGED_PATHS: ReadonlySet<string> = new Set(['/api/health']);

/**
 * Emits one `start-request` entry when a request arrives and one `end-request`
 * entry when the response is flushed, both carrying the same IdTransaction.
 *
 * The request body is deliberately never logged: on this API it is a binary
 * image, so it is both useless as text and large enough to hurt.
 */
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
      message: describeRequest(req.query),
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

function describeRequest(query: unknown): string {
  const hasQuery = typeof query === 'object' && query !== null && Object.keys(query).length > 0;
  return hasQuery ? `Query: ${JSON.stringify(query)}` : 'No request data';
}
