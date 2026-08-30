import type { Env } from '../config/envs/env';
import type { CredentialsProvider } from '../../domain/ports/credentials-provider';
import type { ImageAnnotator } from '../../domain/ports/image-annotator';
import { FakeAnnotator } from './fake.annotator';
import { ImaggaAnnotator } from './imagga.annotator';

/**
 * `credentials` is a factory, not a ready-made provider: building one can
 * itself demand configuration (a secret id outside local development), and the
 * demo annotator must stay usable in every environment without any of it. The
 * factory is only invoked on the branch that actually needs credentials.
 */
export async function createAnnotator(
  env: Env,
  credentials: () => CredentialsProvider,
): Promise<ImageAnnotator> {
  if (env.ANNOTATOR !== 'imagga') {
    return new FakeAnnotator();
  }

  const { apiKey, apiSecret } = await credentials().getAnnotatorCredentials();
  return new ImaggaAnnotator({
    apiKey,
    apiSecret,
    baseUrl: env.IMAGGA_BASE_URL,
    timeoutMs: env.IMAGGA_TIMEOUT_MS,
  });
}
