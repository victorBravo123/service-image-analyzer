import express from 'express';
import { requestLogger } from './middleware/request-logger';
import { analyzeRouter } from './routes/analyze.route';
import { errorHandler } from './middleware/error-handler';
import type { ServerDependencies } from './dto/server-dependencies';

export type { ServerDependencies };

export function buildApp({
  analyzeImage,
  maxImageBytes,
  logger,
}: ServerDependencies): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger(logger));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api', analyzeRouter(analyzeImage, maxImageBytes));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });
  app.use(errorHandler(logger));

  return app;
}
