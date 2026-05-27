import type Database from "better-sqlite3"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { candleIntervals, type CandleInterval } from "../types/domain.js"
import { listCandles, listPairs, listTrades } from "../db/repositories.js"
import { setPublicCache } from "../utils/http.js"
import { findPairBySymbolOrAddress, normalizePairAddress } from "../utils/symbols.js"

const limitSchema = z.coerce.number().int().min(1).max(500).default(100)
const candleLimitSchema = z.coerce.number().int().min(1).max(5000).default(100)

const tradesQuerySchema = z.object({
  pair: z.string().min(1),
  limit: limitSchema,
  before: z.coerce.number().int().positive().optional()
})

const candlesQuerySchema = z.object({
  pair: z.string().min(1),
  interval: z.enum(candleIntervals).default("1h"),
  limit: candleLimitSchema,
  before: z.coerce.number().int().positive().optional(),
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional(),
  order: z.enum(["asc", "desc"]).default("desc")
})

export const registerDexRoutes = async (app: FastifyInstance, db: Database.Database) => {
  app.get("/v1/dex/trades", async (request, reply) => {
    setPublicCache(reply)
    const query = tradesQuerySchema.parse(request.query)
    const pair = findPairBySymbolOrAddress(listPairs(db, true), query.pair)
    const pairAddress = pair?.pairAddress ?? normalizePairAddress(query.pair)
    return {
      pair: pairAddress,
      symbol: pair?.symbol,
      trades: listTrades(db, {
        pairAddress,
        limit: query.limit,
        before: query.before
      })
    }
  })

  app.get("/v1/dex/candles", async (request, reply) => {
    setPublicCache(reply)
    const query = candlesQuerySchema.parse(request.query)
    const pair = findPairBySymbolOrAddress(listPairs(db, true), query.pair)
    const pairAddress = pair?.pairAddress ?? normalizePairAddress(query.pair)
    const interval = query.interval as CandleInterval
    return {
      pair: pairAddress,
      symbol: pair?.symbol,
      interval,
      candles: listCandles(db, {
        pairAddress,
        interval,
        limit: query.limit,
        before: query.before,
        from: query.from,
        to: query.to,
        ascending: query.order === "asc"
      })
    }
  })
}
