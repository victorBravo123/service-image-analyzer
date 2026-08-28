import { createAnnotator } from '../../../src/infrastructure/providers/annotator.factory';
import { FakeAnnotator } from '../../../src/infrastructure/providers/fake.annotator';
import { ImaggaAnnotator } from '../../../src/infrastructure/providers/imagga.annotator';
import { loadEnv } from '../../../src/infrastructure/config/env';
import type { CredentialsProvider } from '../../../src/domain/ports/credentials-provider';

const secrets: CredentialsProvider = {
  getAnnotatorCredentials: () => Promise.resolve({ apiKey: 'key', apiSecret: 'secret' }),
};

describe('createAnnotator', () => {
  it('returns the fake annotator by default (demo mode without credentials)', async () => {
    await expect(createAnnotator(loadEnv({}), secrets)).resolves.toBeInstanceOf(FakeAnnotator);
  });

  it('returns the Imagga annotator when the real provider is selected', async () => {
    const env = loadEnv({
      ANNOTATOR: 'imagga',
      IMAGGA_API_KEY: 'key',
      IMAGGA_API_SECRET: 'secret',
    });

    await expect(createAnnotator(env, secrets)).resolves.toBeInstanceOf(ImaggaAnnotator);
  });

  it('does not touch the secrets provider when the fake annotator is used', async () => {
    const getAnnotatorCredentials = jest.fn();

    await createAnnotator(loadEnv({ ANNOTATOR: 'fake' }), { getAnnotatorCredentials });

    expect(getAnnotatorCredentials).not.toHaveBeenCalled();
  });

  it('fails when credentials cannot be resolved', async () => {
    const failing: CredentialsProvider = {
      getAnnotatorCredentials: () => Promise.reject(new Error('secret unavailable')),
    };
    const env = loadEnv({
      ANNOTATOR: 'imagga',
      IMAGGA_API_KEY: 'key',
      IMAGGA_API_SECRET: 'secret',
    });

    await expect(createAnnotator(env, failing)).rejects.toThrow(/secret unavailable/);
  });
});
