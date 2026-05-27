import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import type { PairConfig } from "../types/domain.js"
import { normalizePairAddress } from "../utils/symbols.js"

const pairSchema = z.object({
  symbol: z.string().min(1),
  pairAddress: z.string().min(1),
  base: z.string().min(1),
  quote: z.string().min(1),
  baseDecimals: z.number().int().min(0).max(30).default(6),
  quoteDecimals: z.number().int().min(0).max(30).default(6),
  dex: z.string().min(1),
  enabled: z.boolean().default(true),
  startHeight: z.number().int().nonnegative().nullable().default(null),
  backfill: z.boolean().default(true)
})

const pairsSchema = z.array(pairSchema).min(1)

export const loadPairsConfig = (
  filePath = path.resolve(process.cwd(), "config/pairs.json")
): PairConfig[] => {
  const raw = readFileSync(filePath, "utf8")
  const pairs = pairsSchema.parse(JSON.parse(raw))
  return pairs.map((pair) => ({
    ...pair,
    pairAddress: normalizePairAddress(pair.pairAddress)
  }))
}
