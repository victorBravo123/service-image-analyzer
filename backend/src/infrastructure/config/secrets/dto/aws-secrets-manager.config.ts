export interface AwsSecretsManagerConfig {
  readonly secretId: string;
  readonly region?: string | undefined;
}
