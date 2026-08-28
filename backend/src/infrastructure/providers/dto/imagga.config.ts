export interface ImaggaConfig {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly timeoutMs: number;
  readonly baseUrl: string;
  readonly maxTags?: number;
}
