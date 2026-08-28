import 'dotenv/config';
import { pino } from 'pino';
import { loadEnv, maxImageBytes } from './infrastructure/config/env';
import { createSecretsProvider } from './infrastructure/config/secrets/secrets-provider.factory';
import { AnalyzeImageUseCase } from './application/use-cases/analyze-image/analyze-image.use-case';
import { createAnnotator } from './infrastructure/providers/annotator.factory';
import { buildApp } from './infrastructure/http/server';

async function main(): Promise<void> {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
  const env = loadEnv();

  const secrets = createSecretsProvider(env);
  const annotator = await createAnnotator(env, secrets);
  const analyzeImage = new AnalyzeImageUseCase(annotator);
  const app = buildApp({ analyzeImage, maxImageBytes: maxImageBytes(env), logger });

  app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, appEnv: env.APP_ENV, annotator: env.ANNOTATOR },
      'image-analyzer API listening',
    );
  });
}

main().catch((error: unknown) => {
  pino().fatal({ err: error }, 'failed to start image-analyzer API');
  process.exit(1);
});
