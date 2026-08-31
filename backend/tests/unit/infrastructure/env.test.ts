import { loadEnv, maxImageBytes } from '../../../src/infrastructure/config/envs/env';

describe('loadEnv', () => {
  it('applies safe defaults for an empty environment', () => {
    expect(loadEnv({})).toMatchObject({
      APP_ENV: 'local',
      PORT: 3000,
      MAX_IMAGE_MB: 5,
      ANNOTATOR: 'fake',
      IMAGGA_BASE_URL: 'https://api.imagga.com/v2',
    });
  });

  it('parses numeric values from strings', () => {
    const env = loadEnv({ PORT: '8080', MAX_IMAGE_MB: '2' });

    expect(env.PORT).toBe(8080);
    expect(maxImageBytes(env)).toBe(2 * 1024 * 1024);
  });

  it('rejects a non-numeric port instead of booting with a broken config', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow(/Invalid environment/);
  });

  it('allows pointing the provider at another endpoint', () => {
    const env = loadEnv({ IMAGGA_BASE_URL: 'https://sandbox.example.com/v2' });

    expect(env.IMAGGA_BASE_URL).toBe('https://sandbox.example.com/v2');
  });

  it('rejects a provider endpoint that is not a URL', () => {
    expect(() => loadEnv({ IMAGGA_BASE_URL: 'not-a-url' })).toThrow(/Invalid environment/);
  });

  it('rejects an unknown annotator', () => {
    expect(() => loadEnv({ ANNOTATOR: 'skynet' })).toThrow(/Invalid environment/);
  });

  it('rejects an unknown application environment', () => {
    expect(() => loadEnv({ APP_ENV: 'preprod' })).toThrow(/Invalid environment/);
  });

  describe('when the real provider is selected locally', () => {
    it('requires credentials in the environment', () => {
      expect(() => loadEnv({ ANNOTATOR: 'imagga', APP_ENV: 'local' })).toThrow(/IMAGGA_API_KEY/);
    });

    it('accepts the configuration once credentials are present', () => {
      const env = loadEnv({
        ANNOTATOR: 'imagga',
        APP_ENV: 'local',
        IMAGGA_API_KEY: 'key',
        IMAGGA_API_SECRET: 'secret',
      });

      expect(env.ANNOTATOR).toBe('imagga');
    });
  });

  describe('when the real provider is selected in a deployed environment', () => {
    it('requires the secret id instead of raw credentials', () => {
      expect(() => loadEnv({ ANNOTATOR: 'imagga', APP_ENV: 'prod' })).toThrow(/IMAGGA_SECRET_ID/);
    });

    it('does not accept raw credentials as a substitute for the secret id', () => {
      expect(() =>
        loadEnv({
          ANNOTATOR: 'imagga',
          APP_ENV: 'prod',
          IMAGGA_API_KEY: 'key',
          IMAGGA_API_SECRET: 'secret',
        }),
      ).toThrow(/IMAGGA_SECRET_ID/);
    });

    it('accepts the configuration once the secret id is present', () => {
      const env = loadEnv({
        ANNOTATOR: 'imagga',
        APP_ENV: 'prod',
        IMAGGA_SECRET_ID: 'image-analyzer/imagga',
      });

      expect(env.IMAGGA_SECRET_ID).toBe('image-analyzer/imagga');
    });
  });

  it('does not require any credentials when the fake annotator is used', () => {
    expect(() => loadEnv({ ANNOTATOR: 'fake', APP_ENV: 'prod' })).not.toThrow();
  });
});
