import { createAnnotator } from '../../../src/infrastructure/providers/annotator.factory';
import { FakeAnnotator } from '../../../src/infrastructure/providers/fake.annotator';
import { CircuitBreakerAnnotator } from '../../../src/infrastructure/resilience/circuit-breaker.annotator';
import { loadEnv } from '../../../src/infrastructure/config/envs/env';
import { createSecretsProvider } from '../../../src/infrastructure/config/secrets/secrets-provider.factory';
import type { CredentialsProvider } from '../../../src/domain/ports/credentials-provider';
import type { Logger } from '../../../src/domain/ports/logger';
import type { CircuitBreakerStore } from '../../../src/domain/ports/circuit-breaker.store';

const noopCircuit = (): CircuitBreakerStore => ({
  isOpen: () => Promise.resolve(false),
  recordFailure: () => Promise.resolve(1),
  recordSuccess: () => Promise.resolve(),
});

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const secrets = (): CredentialsProvider => ({
  getAnnotatorCredentials: () => Promise.resolve({ apiKey: 'key', apiSecret: 'secret' }),
});

describe('createAnnotator', () => {
  it('returns the fake annotator by default (demo mode without credentials)', async () => {
    await expect(
      createAnnotator(loadEnv({}), secrets, noopCircuit, silentLogger),
    ).resolves.toBeInstanceOf(FakeAnnotator);
  });

  it('wraps the Imagga annotator in a circuit breaker when the real provider is selected', async () => {
    const env = loadEnv({
      ANNOTATOR: 'imagga',
      REDIS_URL: 'redis://localhost:6379',
      IMAGGA_API_KEY: 'key',
      IMAGGA_API_SECRET: 'secret',
    });

    // The use case still sees an ImageAnnotator; the breaker is transparent.
    await expect(createAnnotator(env, secrets, noopCircuit, silentLogger)).resolves.toBeInstanceOf(
      CircuitBreakerAnnotator,
    );
  });

  it('does not touch the secrets provider when the fake annotator is used', async () => {
    const getAnnotatorCredentials = jest.fn();

    await createAnnotator(
      loadEnv({ ANNOTATOR: 'fake' }),
      () => ({ getAnnotatorCredentials }),
      noopCircuit,
      silentLogger,
    );

    expect(getAnnotatorCredentials).not.toHaveBeenCalled();
  });

  it('fails when credentials cannot be resolved', async () => {
    const failing = (): CredentialsProvider => ({
      getAnnotatorCredentials: () => Promise.reject(new Error('secret unavailable')),
    });
    const env = loadEnv({
      ANNOTATOR: 'imagga',
      REDIS_URL: 'redis://localhost:6379',
      IMAGGA_API_KEY: 'key',
      IMAGGA_API_SECRET: 'secret',
    });

    await expect(createAnnotator(env, failing, noopCircuit, silentLogger)).rejects.toThrow(
      /secret unavailable/,
    );
  });

  it('never builds the secrets provider for the fake annotator in a deployed environment', async () => {
    // Regression: createSecretsProvider demands IMAGGA_SECRET_ID outside local
    // development, so building it eagerly made ANNOTATOR=fake unusable there.
    const env = loadEnv({ ANNOTATOR: 'fake', APP_ENV: 'qa' });

    await expect(
      createAnnotator(env, () => createSecretsProvider(env), noopCircuit, silentLogger),
    ).resolves.toBeInstanceOf(FakeAnnotator);
  });

  it('still demands the secret id when the deployed environment does use Imagga', async () => {
    const env = loadEnv({
      ANNOTATOR: 'imagga',
      APP_ENV: 'qa',
      IMAGGA_SECRET_ID: 'imagga/qa',
      REDIS_URL: 'redis://localhost:6379',
    });
    const explode = () => {
      throw new Error('should not be reached');
    };

    // The factory is invoked on this branch, so a broken one must surface.
    await expect(createAnnotator(env, explode, noopCircuit, silentLogger)).rejects.toThrow(
      /should not be reached/,
    );
  });
});
