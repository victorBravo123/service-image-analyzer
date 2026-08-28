import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { DomainError } from '../../../domain/errors/domain.error';
import type { Logger } from 'pino';
import type { ErrorResponseBody } from '../dto/error-response.dto';

const STATUS_BY_DOMAIN_CODE: Record<string, number> = {
  UNSUPPORTED_MEDIA_TYPE: 415,
  ANALYSIS_FAILED: 502,
  SERVICE_UNAVAILABLE: 503,
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    const { status, body } = translate(error);
    if (status >= 500) {
      logger.error({ err: error }, 'request failed');
    } else {
      logger.warn({ code: body.error.code }, 'request rejected');
    }
    res.status(status).json(body);
  };
}

function translate(error: unknown): { status: number; body: ErrorResponseBody } {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return reject(413, 'IMAGE_TOO_LARGE', 'Image exceeds the maximum allowed size');
    }
    return reject(400, 'INVALID_UPLOAD', 'Upload must be a single file in the "image" field');
  }
  if (error instanceof DomainError) {
    const status = STATUS_BY_DOMAIN_CODE[error.code] ?? 500;
    return reject(status, error.code, error.message);
  }
  return reject(500, 'INTERNAL_ERROR', 'Unexpected server error');
}

function reject(
  status: number,
  code: string,
  message: string,
): { status: number; body: ErrorResponseBody } {
  return { status, body: { error: { code, message } } };
}
