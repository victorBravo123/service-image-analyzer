import type { Env } from '../config/env';
import type { CredentialsProvider } from '../../domain/ports/credentials-provider';
import type { ImageAnnotator } from '../../domain/ports/image-annotator';
import { FakeAnnotator } from './fake.annotator';
import { ImaggaAnnotator } from './imagga.annotator';

export async function createAnnotator(
  env: Env,
  credentials: CredentialsProvider,
): Promise<ImageAnnotator> {
  if (env.ANNOTATOR !== 'imagga') {
    return new FakeAnnotator();
  }

  const { apiKey, apiSecret } = await credentials.getAnnotatorCredentials();
  return new ImaggaAnnotator({
    apiKey,
    apiSecret,
    baseUrl: env.IMAGGA_BASE_URL,
    timeoutMs: env.IMAGGA_TIMEOUT_MS,
  });
}
