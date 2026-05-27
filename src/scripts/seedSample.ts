import { getDatabase } from "../db/connection.js"
import { runMigrations } from "../db/schema.js"
import { insertTrades, listPairs } from "../db/repositories.js"
import { CandleService } from "../services/CandleService.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { generateSampleTrades } from "./sampleData.js"

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const pairs = listPairs(db, true)

for (const pair of pairs) {
  const trades = generateSampleTrades(pair)
  const inserted = insertTrades(db, trades)
  const result = new CandleService(db).aggregatePair(pair.pairAddress)
  console.log(
    `Seeded ${inserted} new sample trades for ${pair.symbol}. Aggregated ${result.candleCount} candles from ${result.tradeCount} trades.`
  )
}
