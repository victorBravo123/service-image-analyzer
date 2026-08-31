import { z } from 'zod';

const imaggaTagSchema = z.object({
  confidence: z.number().optional(),
  tag: z.object({ en: z.string().optional() }).optional(),
});

export const imaggaTagsResponseSchema = z.object({
  status: z.object({
    type: z.string(),
    text: z.string().optional(),
  }),
  result: z
    .object({
      tags: z.array(imaggaTagSchema).optional(),
    })
    .optional(),
});

export type ImaggaTagsResponse = z.infer<typeof imaggaTagsResponseSchema>;
export type ImaggaTag = z.infer<typeof imaggaTagSchema>;
