import { z } from "zod";

export const envConfig = z
  .object({
    MEILI_ADDR: z.string().optional(),
    MEILI_MASTER_KEY: z.string().default(""),
    MEILI_INDEX_PREFIX: z
      .string()
      .regex(/^[A-Za-z0-9_-]*$/)
      .default(""),
    MEILI_BATCH_SIZE: z.coerce.number().int().positive().default(50),
    MEILI_BATCH_TIMEOUT_MS: z.coerce.number().int().positive().default(500),
  })
  .parse(process.env);
