import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { CredentialsProvider } from '../../../domain/ports/credentials-provider';
import type { AnnotatorCredentials } from '../../../domain/model/annotator-credentials';
import type { AwsSecretsManagerConfig } from './dto/aws-secrets-manager.config';
import { imaggaSecretPayloadSchema } from './dto/imagga-secret-payload.schema';

export class AwsSecretsManagerProvider implements CredentialsProvider {
  private cached: Promise<AnnotatorCredentials> | undefined;

  constructor(
    private readonly config: AwsSecretsManagerConfig,
    private readonly client: SecretsManagerClient = new SecretsManagerClient(
      config.region ? { region: config.region } : {},
    ),
  ) {}

  getAnnotatorCredentials(): Promise<AnnotatorCredentials> {
    this.cached ??= this.fetchCredentials();
    return this.cached;
  }

  private async fetchCredentials(): Promise<AnnotatorCredentials> {
    const raw = await this.readSecretString();
    const parsed = imaggaSecretPayloadSchema.safeParse(parseJson(raw, this.config.secretId));

    if (!parsed.success) {
      throw new Error(
        `Secret "${this.config.secretId}" must contain IMAGGA_API_KEY and IMAGGA_API_SECRET`,
      );
    }
    return {
      apiKey: parsed.data.IMAGGA_API_KEY,
      apiSecret: parsed.data.IMAGGA_API_SECRET,
    };
  }

  private async readSecretString(): Promise<string> {
    let response;
    try {
      response = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.config.secretId }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new Error(`Could not read secret "${this.config.secretId}": ${reason}`);
    }

    if (!response.SecretString) {
      throw new Error(`Secret "${this.config.secretId}" has no string value`);
    }
    return response.SecretString;
  }
}

function parseJson(raw: string, secretId: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Secret "${secretId}" is not valid JSON`);
  }
}
