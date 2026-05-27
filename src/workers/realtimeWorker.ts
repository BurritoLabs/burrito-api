import { env } from "../config/env.js"
import { getDatabase } from "../db/connection.js"
import {
  getSyncState,
  insertTrades,
  listHotPairs,
  upsertSyncState
} from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import { createTradeProvider } from "../providers/createTradeProvider.js"
import { CandleService } from "../services/CandleService.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { nowUnixSeconds } from "../utils/time.js"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const formatError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
let shouldStop = false

process.once("SIGINT", () => {
  shouldStop = true
})

process.once("SIGTERM", () => {
  shouldStop = true
})

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const provider = createTradeProvider()
const candleService = new CandleService(db)

if (!env.INDEXER_ENABLED) {
  console.log("Realtime worker is disabled because INDEXER_ENABLED=false.")
  process.exit(0)
}

console.log(`Realtime worker started with provider=${provider.name}.`)

while (!shouldStop) {
  const pairs = listHotPairs(db)
  let latestHeight: number | undefined
  try {
    latestHeight = provider.getLatestHeight ? await provider.getLatestHeight() : undefined
  } catch (error) {
    console.error(`Unable to read latest height from ${provider.name}: ${formatError(error)}`)
    await sleep(env.INDEXER_INTERVAL_SECONDS * 1000)
    continue
  }
  const safeLatestHeight =
    latestHeight !== undefined
      ? Math.max(1, latestHeight - env.INDEXER_CONFIRMATIONS)
      : undefined

  for (const pair of pairs) {
    const state = getSyncState(db, pair.pairAddress, "realtime")
    let fromHeight: number
    if (state) {
      fromHeight = state.lastHeight + 1
    } else if (pair.startHeight !== null) {
      fromHeight = pair.startHeight
    } else if (safeLatestHeight !== undefined) {
      fromHeight = safeLatestHeight
    } else {
      console.log(
        `Skipping ${pair.symbol}: startHeight is null. Realtime height discovery is not implemented in v0.1.`
      )
      continue
    }

    const toHeight = safeLatestHeight
      ? Math.min(safeLatestHeight, fromHeight + env.INDEXER_BATCH_BLOCKS - 1)
      : fromHeight
    if (toHeight < fromHeight) continue

    let trades
    try {
      trades = await provider.fetchTrades(pair, { fromHeight, toHeight })
    } catch (error) {
      console.error(
        `realtime failed pair=${pair.symbol} range=${fromHeight}-${toHeight}: ${formatError(error)}`
      )
      continue
    }
    if (trades.length) {
      const inserted = insertTrades(db, trades)
      const timestamps = trades.map((trade) => trade.timestamp)
      const result =
        inserted && timestamps.length
          ? candleService.aggregatePairForTimeRange(
              pair.pairAddress,
              Math.min(...timestamps),
              Math.max(...timestamps)
            )
          : { candleCount: 0, tradeCount: 0 }
      console.log(
        `pair=${pair.symbol} inserted=${inserted} candles=${result.candleCount} trades=${result.tradeCount}`
      )
    }

    upsertSyncState(db, {
      pairAddress: pair.pairAddress,
      worker: "realtime",
      lastHeight: toHeight,
      lastTimestamp: nowUnixSeconds()
    })
  }

  await sleep(env.INDEXER_INTERVAL_SECONDS * 1000)
}

db.close()
console.log("Realtime worker stopped.")
