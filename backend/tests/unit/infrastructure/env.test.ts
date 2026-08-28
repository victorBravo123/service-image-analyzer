import { loadEnv, maxImageBytes } from '../../../src/infrastructure/config/env';

describe('loadEnv', () => {
  it('applies safe defaults for an empty environment', () => {
    expect(loadEnv({})).toEqual({ PORT: 3000, MAX_IMAGE_MB: 5 });
  });

  it('parses numeric values from strings', () => {
    const env = loadEnv({ PORT: '8080', MAX_IMAGE_MB: '2' });

    expect(env.PORT).toBe(8080);
    expect(maxImageBytes(env)).toBe(2 * 1024 * 1024);
  });

  it('rejects a non-numeric port instead of booting with a broken config', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow(/Invalid environment/);
  });
});
