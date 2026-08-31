import { z } from 'zod';
import { ConfigurationError } from '../configuration.error';
import { LOCAL_CREDENTIAL_KEYS } from '../constants/config.constants';

const envSchema = z
  .object({
    /** Where the process runs. Only "local" reads credentials from the environment. */
    APP_ENV: z.enum(['local', 'dev', 'qa', 'staging', 'prod']).default('local'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MAX_IMAGE_MB: z.coerce.number().positive().default(5),
    ANNOTATOR: z.enum(['imagga', 'fake']).default('fake'),
    IMAGGA_BASE_URL: z.string().trim().url().default('https://api.imagga.com/v2'),
    IMAGGA_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

    REDIS_URL: z.string().trim().url().optional(),
    REDIS_USERNAME: z.string().trim().optional(),
    REDIS_PASSWORD: z.string().trim().optional(),
    CB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
    CB_OPEN_MS: z.coerce.number().int().positive().default(60_000),

    // Credentials for APP_ENV=local only.
    IMAGGA_API_KEY: z.string().trim().optional(),
    IMAGGA_API_SECRET: z.string().trim().optional(),

    // Credentials for every other environment, resolved from AWS Secrets Manager.
    IMAGGA_SECRET_ID: z.string().trim().optional(),
    AWS_REGION: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.ANNOTATOR !== 'imagga') {
      return;
    }
    if (!env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'REDIS_URL is required when ANNOTATOR=imagga: the circuit breaker keeps its state there.',
      });
    }
    if (env.APP_ENV === 'local') {
      const missing = LOCAL_CREDENTIAL_KEYS.filter((key) => !env[key]);
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `missing ${missing.join(' and ')} — required when ANNOTATOR=imagga and ` +
            'APP_ENV=local. Use ANNOTATOR=fake to run without credentials.',
        });
      }
      return;
    }
    if (!env.IMAGGA_SECRET_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `IMAGGA_SECRET_ID is required when ANNOTATOR=imagga and APP_ENV=${env.APP_ENV}: ` +
          'credentials are read from AWS Secrets Manager outside local development.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export type LogLevel = Env['LOG_LEVEL'];

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) =>
        issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ');

    throw new ConfigurationError(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export function maxImageBytes(env: Env): number {
  return Math.floor(env.MAX_IMAGE_MB * 1024 * 1024);
}
