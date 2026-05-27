import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("127.0.0.1"),
  CHAIN_ID: z.string().default("columbus-5"),
  LCD_URL: z.string().url().default("http://127.0.0.1:1317"),
  RPC_URL: z.string().url().default("http://127.0.0.1:26657"),
  FCD_URL: z.string().optional().default(""),
  DATABASE_PATH: z.string().min(1).default("./data/burrito-candles.sqlite"),
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(10),
  INDEXER_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((value) => value === "true" || value === "1"),
  INDEXER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  INDEXER_BATCH_BLOCKS: z.coerce.number().int().positive().default(100),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().nonnegative().default(1),
  BACKFILL_BATCH_BLOCKS: z.coerce.number().int().positive().default(100),
  BACKFILL_MAX_BATCHES_PER_RUN: z.coerce.number().int().positive().default(100),
  BACKFILL_SLEEP_MS: z.coerce.number().int().nonnegative().default(250),
  TRADE_PROVIDER: z.enum(["rpc", "binodes", "fcd"]).default("rpc")
})

export const env = envSchema.parse(process.env)
