import type { Env } from '../env';
import type { CredentialsProvider } from '../../../domain/ports/credentials-provider';
import { EnvSecretsProvider } from './env-secrets.provider';
import { AwsSecretsManagerProvider } from './aws-secrets-manager.provider';

export function createSecretsProvider(env: Env): CredentialsProvider {
  if (env.APP_ENV === 'local') {
    return new EnvSecretsProvider(env);
  }
  if (!env.IMAGGA_SECRET_ID) {
    throw new Error(`IMAGGA_SECRET_ID is required when APP_ENV=${env.APP_ENV}`);
  }
  return new AwsSecretsManagerProvider({
    secretId: env.IMAGGA_SECRET_ID,
    region: env.AWS_REGION,
  });
}
