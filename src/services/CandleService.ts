import type Database from "better-sqlite3"
import type {
  CandleInterval,
  CandleRecord,
  TradeRecord
} from "../types/domain.js"
import { candleIntervals } from "../types/domain.js"
import { decimalAdd, decimalMax, decimalMin } from "../utils/decimal.js"
import { floorTimeToInterval } from "../utils/time.js"
import { listAllTradesForPair, upsertCandles } from "../db/repositories.js"
import { normalizePairAddress } from "../utils/symbols.js"

type CandleDraft = Omit<CandleRecord, "id" | "updatedAt">

export class CandleService {
  constructor(private readonly db: Database.Database) {}

  aggregatePair(pairAddress: string, intervals: readonly CandleInterval[] = candleIntervals) {
    const normalizedPairAddress = normalizePairAddress(pairAddress)
    const trades = listAllTradesForPair(this.db, normalizedPairAddress)
    let candleCount = 0

    for (const interval of intervals) {
      const candles = this.aggregateTradesForInterval(trades, interval)
      upsertCandles(this.db, candles)
      candleCount += candles.length
    }

    return {
      pairAddress: normalizedPairAddress,
      tradeCount: trades.length,
      candleCount
    }
  }

  aggregateTradesForInterval(
    trades: TradeRecord[],
    interval: CandleInterval
  ): CandleDraft[] {
    const buckets = new Map<number, CandleDraft>()

    for (const trade of trades) {
      const time = floorTimeToInterval(trade.timestamp, interval)
      const existing = buckets.get(time)

      if (!existing) {
        buckets.set(time, {
          pairAddress: trade.pairAddress,
          interval,
          time,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.volume,
          tradeCount: 1
        })
        continue
      }

      existing.high = decimalMax(existing.high, trade.price)
      existing.low = decimalMin(existing.low, trade.price)
      existing.close = trade.price
      existing.volume = decimalAdd(existing.volume, trade.volume)
      existing.tradeCount += 1
    }

    return [...buckets.values()].sort((a, b) => a.time - b.time)
  }
}
