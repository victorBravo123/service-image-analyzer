import { z } from 'zod';

export const imaggaSecretPayloadSchema = z.object({
  IMAGGA_API_KEY: z.string().trim().min(1),
  IMAGGA_API_SECRET: z.string().trim().min(1),
});

export type ImaggaSecretPayload = z.infer<typeof imaggaSecretPayloadSchema>;
