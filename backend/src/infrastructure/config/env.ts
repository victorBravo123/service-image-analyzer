import { z } from 'zod';

const envSchema = z
  .object({
    /** Where the process runs. Only "local" reads credentials from the environment. */
    APP_ENV: z.enum(['local', 'dev', 'qa', 'staging', 'prod']).default('local'),
    PORT: z.coerce.number().int().positive().default(3000),
    MAX_IMAGE_MB: z.coerce.number().positive().default(5),
    ANNOTATOR: z.enum(['imagga', 'fake']).default('fake'),
    IMAGGA_BASE_URL: z.string().trim().url().default('https://api.imagga.com/v2'),
    IMAGGA_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

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
    if (env.APP_ENV === 'local') {
      if (!env.IMAGGA_API_KEY || !env.IMAGGA_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'IMAGGA_API_KEY and IMAGGA_API_SECRET are required when ANNOTATOR=imagga and ' +
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

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export function maxImageBytes(env: Env): number {
  return Math.floor(env.MAX_IMAGE_MB * 1024 * 1024);
}
