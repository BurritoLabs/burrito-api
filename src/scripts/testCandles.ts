import assert from "node:assert/strict"
import { createDatabase } from "../db/connection.js"
import { runMigrations } from "../db/schema.js"
import { insertTrades, listCandles, listPairs, upsertPairs } from "../db/repositories.js"
import { CandleService } from "../services/CandleService.js"
import { generateSampleTrades } from "./sampleData.js"

const db = createDatabase(":memory:")
runMigrations(db)

upsertPairs(db, [
  {
    symbol: "LUNC/USTC",
    pairAddress: "terra_test_pair",
    base: "uluna",
    quote: "uusd",
    baseDecimals: 6,
    quoteDecimals: 6,
    dex: "terraswap",
    enabled: true,
    startHeight: 28700000,
    backfill: true
  }
])

const [pair] = listPairs(db, true)
assert.ok(pair)

const trades = generateSampleTrades(pair, 24)
assert.equal(insertTrades(db, trades), 24)

const result = new CandleService(db).aggregatePair(pair.pairAddress)
assert.equal(result.tradeCount, 24)
assert.ok(result.candleCount > 0)

const oneHourCandles = listCandles(db, {
  pairAddress: pair.pairAddress,
  interval: "1h",
  limit: 100,
  ascending: true
})

assert.ok(oneHourCandles.length > 0)
for (const candle of oneHourCandles) {
  assert.ok(Number(candle.high) >= Number(candle.low))
  assert.ok(Number(candle.tradeCount) > 0)
}

console.log(`Candle test passed with ${oneHourCandles.length} 1h candles.`)
