import 'dotenv/config';
import { pino } from 'pino';
import { loadEnv, maxImageBytes } from './infrastructure/config/envs/env';
import { ConfigurationError } from './infrastructure/config/configuration.error';
import { createSecretsProvider } from './infrastructure/config/secrets/secrets-provider.factory';
import { AnalyzeImageUseCase } from './application/use-cases/analyze-image/analyze-image.use-case';
import { createAnnotator } from './infrastructure/providers/annotator.factory';
import { buildApp } from './infrastructure/http/server';
import { SERVICE } from './infrastructure/config/constants/config.constants';
import { PinoLogger } from './infrastructure/config/logging/pino.logger';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new PinoLogger({
    level: env.LOG_LEVEL,
    serviceName: SERVICE.NAME,
    version: SERVICE.VERSION,
  });

  // Passed lazily: outside local development building the secrets provider
  // demands IMAGGA_SECRET_ID, which ANNOTATOR=fake must not require.
  const annotator = await createAnnotator(env, () => createSecretsProvider(env));
  const analyzeImage = new AnalyzeImageUseCase(annotator);
  const app = buildApp({ analyzeImage, maxImageBytes: maxImageBytes(env), logger });

  app.listen(env.PORT, () => {
    logger.info({
      action: 'startup',
      event: `listening on port ${String(env.PORT)}`,
      status: 'ok',
      code: '0',
      message: `image-analyzer API listening — appEnv=${env.APP_ENV} annotator=${env.ANNOTATOR}`,
    });
  });
}

main().catch((error: unknown) => {
  // The Logger port may not exist yet if configuration failed, so startup
  // failures fall back to a bare pino instance.
  const logger = pino();
  // A misconfigured start is operator error: the message is the whole story,
  // and a stack trace would only bury it. Anything else is a real failure.
  if (error instanceof ConfigurationError) {
    logger.fatal(error.message);
  } else {
    logger.fatal({ err: error }, 'failed to start image-analyzer API');
  }
  process.exit(1);
});
