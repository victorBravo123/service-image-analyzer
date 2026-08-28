import 'dotenv/config';
import { pino } from 'pino';
import { loadEnv, maxImageBytes } from './infrastructure/config/env';
import { AnalyzeImageUseCase } from './application/analyze-image.use-case';
import { FakeAnnotator } from './infrastructure/providers/fake.annotator';
import { buildApp } from './infrastructure/http/server';

/**
 * Composition root: the only file that knows every concrete adapter and
 * wires them into the hexagon.
 */
function main(): void {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
  const env = loadEnv();

  const annotator = new FakeAnnotator();
  const analyzeImage = new AnalyzeImageUseCase(annotator);
  const app = buildApp({ analyzeImage, maxImageBytes: maxImageBytes(env), logger });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'image-analyzer API listening');
  });
}

main();
