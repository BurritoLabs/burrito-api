import type Database from "better-sqlite3"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import type { CandleInterval, PairRecord } from "../types/domain.js"
import { listCandles, listPairs } from "../db/repositories.js"
import { setPublicCache } from "../utils/http.js"
import { findPairBySymbolOrAddress, toTradingViewSymbol } from "../utils/symbols.js"

const supportedResolutions = ["1", "5", "15", "60", "240", "D"] as const

const resolutionToInterval = (resolution: string): CandleInterval | undefined => {
  const normalized = resolution.toUpperCase()
  if (normalized === "1") return "1m"
  if (normalized === "5") return "5m"
  if (normalized === "15") return "15m"
  if (normalized === "60") return "1h"
  if (normalized === "240") return "4h"
  if (normalized === "D" || normalized === "1D") return "1d"
  return undefined
}

const toSymbolInfo = (pair: PairRecord) => ({
  name: toTradingViewSymbol(pair.symbol),
  ticker: toTradingViewSymbol(pair.symbol),
  description: `${pair.symbol} on ${pair.dex}`,
  type: "crypto",
  session: "24x7",
  timezone: "Etc/UTC",
  exchange: pair.dex,
  minmov: 1,
  pricescale: 100000000,
  has_intraday: true,
  has_daily: true,
  supported_resolutions: supportedResolutions,
  volume_precision: 8,
  data_status: "streaming"
})

const symbolQuerySchema = z.object({
  symbol: z.string().min(1)
})

const searchQuerySchema = z.object({
  query: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30)
})

const historyQuerySchema = z.object({
  symbol: z.string().min(1),
  resolution: z.string().min(1),
  from: z.coerce.number().int().nonnegative(),
  to: z.coerce.number().int().nonnegative()
})

export const registerTradingViewRoutes = async (
  app: FastifyInstance,
  db: Database.Database
) => {
  app.get("/v1/tradingview/config", async (_request, reply) => {
    setPublicCache(reply)
    return {
      supported_resolutions: supportedResolutions,
      supports_group_request: false,
      supports_marks: false,
      supports_search: true,
      supports_timescale_marks: false
    }
  })

  app.get("/v1/tradingview/symbols", async (request, reply) => {
    setPublicCache(reply)
    const query = symbolQuerySchema.parse(request.query)
    const pair = findPairBySymbolOrAddress(listPairs(db, true), query.symbol)
    if (!pair) {
      return reply.code(404).send({ s: "error", errmsg: "Symbol not found" })
    }
    return toSymbolInfo(pair)
  })

  app.get("/v1/tradingview/search", async (request, reply) => {
    setPublicCache(reply)
    const query = searchQuerySchema.parse(request.query)
    const needle = query.query.trim().toLowerCase()
    return listPairs(db, true)
      .filter((pair) => {
        if (!needle) return true
        return (
          pair.symbol.toLowerCase().includes(needle) ||
          toTradingViewSymbol(pair.symbol).toLowerCase().includes(needle) ||
          pair.pairAddress.toLowerCase().includes(needle)
        )
      })
      .slice(0, query.limit)
      .map((pair) => ({
        symbol: toTradingViewSymbol(pair.symbol),
        full_name: `${pair.dex}:${toTradingViewSymbol(pair.symbol)}`,
        description: `${pair.symbol} on ${pair.dex}`,
        exchange: pair.dex,
        ticker: toTradingViewSymbol(pair.symbol),
        type: "crypto"
      }))
  })

  app.get("/v1/tradingview/history", async (request, reply) => {
    setPublicCache(reply)
    const query = historyQuerySchema.parse(request.query)
    const interval = resolutionToInterval(query.resolution)
    if (!interval) {
      return reply.code(400).send({ s: "error", errmsg: "Unsupported resolution" })
    }

    const pair = findPairBySymbolOrAddress(listPairs(db, true), query.symbol)
    if (!pair) return { s: "no_data" }

    const candles = listCandles(db, {
      pairAddress: pair.pairAddress,
      interval,
      limit: 5000,
      from: query.from,
      to: query.to,
      ascending: true
    })

    if (!candles.length) return { s: "no_data" }

    return {
      s: "ok",
      t: candles.map((candle) => candle.time),
      o: candles.map((candle) => Number(candle.open)),
      h: candles.map((candle) => Number(candle.high)),
      l: candles.map((candle) => Number(candle.low)),
      c: candles.map((candle) => Number(candle.close)),
      v: candles.map((candle) => Number(candle.volume))
    }
  })
}
