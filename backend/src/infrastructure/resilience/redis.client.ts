import { Redis } from 'ioredis';
import type { Env } from '../config/envs/env';
import type { Logger } from '../../domain/ports/logger';

const MAX_RETRY_DELAY_MS = 10_000;

export function createRedisClient(env: Env, logger: Logger): Redis {
  const client = new Redis(env.REDIS_URL ?? '', {
    ...(env.REDIS_USERNAME ? { username: env.REDIS_USERNAME } : {}),
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, MAX_RETRY_DELAY_MS),
  });

  client.on('error', (error: Error) => {
    logger.error({
      action: 'error',
      code: 'REDIS_UNAVAILABLE',
      message: `circuit breaker store unreachable: ${error.message}`,
    });
  });

  return client;
}
