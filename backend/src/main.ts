import 'dotenv/config';
import { pino } from 'pino';
import { loadEnv, maxImageBytes } from './infrastructure/config/envs/env';
import { ConfigurationError } from './infrastructure/config/configuration.error';
import { createSecretsProvider } from './infrastructure/config/secrets/secrets-provider.factory';
import { AnalyzeImageUseCase } from './application/use-cases/analyze-image/analyze-image.use-case';
import { createAnnotator } from './infrastructure/providers/annotator.factory';
import { RedisCircuitBreakerStore } from './infrastructure/resilience/redis-circuit-breaker.store';
import { createRedisClient } from './infrastructure/resilience/redis.client';
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

  const annotator = await createAnnotator(
    env,
    () => createSecretsProvider(env),
    () =>
      new RedisCircuitBreakerStore(
        createRedisClient(env, logger),
        env.CB_FAILURE_THRESHOLD,
        env.CB_OPEN_MS,
      ),
    logger,
  );
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
  const logger = pino();
  if (error instanceof ConfigurationError) {
    logger.fatal(error.message);
  } else {
    logger.fatal({ err: error }, 'failed to start image-analyzer API');
  }
  process.exit(1);
});
