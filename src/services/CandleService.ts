import type Database from "better-sqlite3"
import type {
  CandleInterval,
  CandleRecord,
  TradeRecord
} from "../types/domain.js"
import { candleIntervals, intervalSeconds } from "../types/domain.js"
import { decimalAdd, decimalMax, decimalMin } from "../utils/decimal.js"
import { floorTimeToInterval } from "../utils/time.js"
import {
  listAllTradesForPair,
  listTradesForPairInTimeRange,
  upsertCandles
} from "../db/repositories.js"
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

  aggregatePairForTimeRange(
    pairAddress: string,
    fromTimestamp: number,
    toTimestamp: number,
    intervals: readonly CandleInterval[] = candleIntervals
  ) {
    const normalizedPairAddress = normalizePairAddress(pairAddress)
    let tradeCount = 0
    let candleCount = 0

    for (const interval of intervals) {
      const fromBucket = floorTimeToInterval(fromTimestamp, interval)
      const toBucketExclusive =
        floorTimeToInterval(toTimestamp, interval) + intervalSeconds[interval]
      const trades = listTradesForPairInTimeRange(
        this.db,
        normalizedPairAddress,
        fromBucket,
        toBucketExclusive
      )
      const candles = this.aggregateTradesForInterval(trades, interval)
      upsertCandles(this.db, candles)
      tradeCount = Math.max(tradeCount, trades.length)
      candleCount += candles.length
    }

    return {
      pairAddress: normalizedPairAddress,
      tradeCount,
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
