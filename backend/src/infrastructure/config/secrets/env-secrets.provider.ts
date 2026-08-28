import type { CredentialsProvider } from '../../../domain/ports/credentials-provider';
import type { AnnotatorCredentials } from '../../../domain/model/annotator-credentials';
import type { EnvCredentialsSource } from './dto/env-credentials.source';

export class EnvSecretsProvider implements CredentialsProvider {
  constructor(private readonly source: EnvCredentialsSource) {}

  getAnnotatorCredentials(): Promise<AnnotatorCredentials> {
    const apiKey = this.source.IMAGGA_API_KEY;
    const apiSecret = this.source.IMAGGA_API_SECRET;

    if (!apiKey || !apiSecret) {
      return Promise.reject(
        new Error('IMAGGA_API_KEY and IMAGGA_API_SECRET must be set when APP_ENV=local'),
      );
    }
    return Promise.resolve({ apiKey, apiSecret });
  }
}
