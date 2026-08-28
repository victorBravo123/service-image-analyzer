import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MAX_IMAGE_MB: z.coerce.number().positive().default(5),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Fail-fast configuration: the process refuses to boot with an invalid
 * environment instead of failing later on the first request.
 */
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
