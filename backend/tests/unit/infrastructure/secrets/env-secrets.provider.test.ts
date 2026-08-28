import { EnvSecretsProvider } from '../../../../src/infrastructure/config/secrets/env-secrets.provider';

describe('EnvSecretsProvider', () => {
  it('returns the credentials found in the environment', async () => {
    const provider = new EnvSecretsProvider({
      IMAGGA_API_KEY: 'acc_key',
      IMAGGA_API_SECRET: 'secret',
    });

    await expect(provider.getAnnotatorCredentials()).resolves.toEqual({
      apiKey: 'acc_key',
      apiSecret: 'secret',
    });
  });

  it.each([
    ['no credentials at all', {}],
    ['only the key', { IMAGGA_API_KEY: 'acc_key' }],
    ['only the secret', { IMAGGA_API_SECRET: 'secret' }],
  ])('fails with a clear message when there are %s', async (_case, source) => {
    const provider = new EnvSecretsProvider(source);

    await expect(provider.getAnnotatorCredentials()).rejects.toThrow(/APP_ENV=local/);
  });
});
