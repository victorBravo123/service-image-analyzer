import type { Env } from '../config/envs/env';
import type { CircuitBreakerStore } from '../../domain/ports/circuit-breaker.store';
import type { CredentialsProvider } from '../../domain/ports/credentials-provider';
import type { ImageAnnotator } from '../../domain/ports/image-annotator';
import type { Logger } from '../../domain/ports/logger';
import { CircuitBreakerAnnotator } from '../resilience/circuit-breaker.annotator';
import { FakeAnnotator } from './fake.annotator';
import { ImaggaAnnotator } from './imagga.annotator';

export async function createAnnotator(
  env: Env,
  credentials: () => CredentialsProvider,
  circuit: () => CircuitBreakerStore,
  logger: Logger,
): Promise<ImageAnnotator> {
  if (env.ANNOTATOR !== 'imagga') {
    return new FakeAnnotator();
  }

  const { apiKey, apiSecret } = await credentials().getAnnotatorCredentials();
  const imagga = new ImaggaAnnotator({
    apiKey,
    apiSecret,
    baseUrl: env.IMAGGA_BASE_URL,
    timeoutMs: env.IMAGGA_TIMEOUT_MS,
  });

  return new CircuitBreakerAnnotator(imagga, circuit(), logger);
}
