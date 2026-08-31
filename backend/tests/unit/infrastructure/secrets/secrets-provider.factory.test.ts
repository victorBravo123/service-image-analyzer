import { createSecretsProvider } from '../../../../src/infrastructure/config/secrets/secrets-provider.factory';
import { EnvSecretsProvider } from '../../../../src/infrastructure/config/secrets/env-secrets.provider';
import { AwsSecretsManagerProvider } from '../../../../src/infrastructure/config/secrets/aws-secrets-manager.provider';
import { loadEnv } from '../../../../src/infrastructure/config/envs/env';

describe('createSecretsProvider', () => {
  it('reads credentials from the environment while developing locally', () => {
    const env = loadEnv({
      APP_ENV: 'local',
      ANNOTATOR: 'imagga',
      REDIS_URL: 'redis://localhost:6379',
      IMAGGA_API_KEY: 'key',
      IMAGGA_API_SECRET: 'secret',
    });

    expect(createSecretsProvider(env)).toBeInstanceOf(EnvSecretsProvider);
  });

  it('reads credentials from AWS Secrets Manager in deployed environments', () => {
    const env = loadEnv({
      APP_ENV: 'prod',
      ANNOTATOR: 'imagga',
      REDIS_URL: 'redis://localhost:6379',
      IMAGGA_SECRET_ID: 'image-analyzer/imagga',
      AWS_REGION: 'us-east-1',
    });

    expect(createSecretsProvider(env)).toBeInstanceOf(AwsSecretsManagerProvider);
  });

  it('refuses to build an AWS provider without a secret id', () => {
    const env = loadEnv({ APP_ENV: 'prod', ANNOTATOR: 'fake' });

    expect(() => createSecretsProvider(env)).toThrow(/IMAGGA_SECRET_ID is required/);
  });
});
