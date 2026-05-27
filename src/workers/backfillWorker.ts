import { getDatabase } from "../db/connection.js"
import {
  getSyncState,
  insertTrades,
  listPairs,
  upsertSyncState
} from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import { createTradeProvider } from "../providers/createTradeProvider.js"
import { CandleService } from "../services/CandleService.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { env } from "../config/env.js"
import { nowUnixSeconds } from "../utils/time.js"
import { getNumberArg, getStringArg, parseArgs } from "../scripts/args.js"
import { normalizePairAddress, toTradingViewSymbol } from "../utils/symbols.js"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const args = parseArgs()
const pairFilter = getStringArg(args, "pair")
const toHeightArg = getNumberArg(args, "to-height")
const batchBlocks = getNumberArg(args, "batch-blocks") ?? env.BACKFILL_BATCH_BLOCKS
const maxBatches =
  getNumberArg(args, "max-batches") ?? env.BACKFILL_MAX_BATCHES_PER_RUN
const sleepMs = getNumberArg(args, "sleep-ms") ?? env.BACKFILL_SLEEP_MS

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const provider = createTradeProvider()
const candleService = new CandleService(db)
const pairs = listPairs(db, true)
  .filter((pair) => pair.backfill)
  .filter((pair) => {
    if (!pairFilter) return true
    const normalizedFilter = pairFilter.toLowerCase()
    return (
      pair.pairAddress === normalizePairAddress(pairFilter) ||
      pair.symbol.toLowerCase() === normalizedFilter ||
      toTradingViewSymbol(pair.symbol).toLowerCase() === normalizedFilter
    )
  })
const actionablePairs = pairs.filter((pair) => {
  if (pair.startHeight === null) {
    console.log(
      `Skipping ${pair.symbol}: startHeight is null. Later versions can auto-detect contract creation height.`
    )
    return false
  }
  return true
})

if (!actionablePairs.length) {
  console.log("No pairs are ready for backfill.")
  process.exit(0)
}

const latestHeight = toHeightArg ?? (provider.getLatestHeight ? await provider.getLatestHeight() : undefined)
const safeLatestHeight =
  latestHeight !== undefined
    ? Math.max(1, toHeightArg ?? latestHeight - env.INDEXER_CONFIRMATIONS)
    : undefined

if (safeLatestHeight === undefined) {
  console.log(
    `Backfill provider ${provider.name} cannot report latest height yet. Nothing to backfill.`
  )
  process.exit(0)
}

let processedBatches = 0

for (const pair of actionablePairs) {
  const state = getSyncState(db, pair.pairAddress, "backfill")
  let fromHeight = state ? state.lastHeight + 1 : pair.startHeight!

  while (fromHeight <= safeLatestHeight && processedBatches < maxBatches) {
    const toHeight = Math.min(safeLatestHeight, fromHeight + batchBlocks - 1)
    const trades = await provider.fetchTrades(pair, { fromHeight, toHeight })
    const inserted = trades.length ? insertTrades(db, trades) : 0
    const result = inserted ? candleService.aggregatePair(pair.pairAddress) : undefined

    upsertSyncState(db, {
      pairAddress: pair.pairAddress,
      worker: "backfill",
      lastHeight: toHeight,
      lastTimestamp: nowUnixSeconds()
    })

    console.log(
      `backfill pair=${pair.symbol} range=${fromHeight}-${toHeight} inserted=${inserted} candles=${result?.candleCount ?? 0}`
    )

    fromHeight = toHeight + 1
    processedBatches += 1
    if (sleepMs > 0 && processedBatches < maxBatches) {
      await sleep(sleepMs)
    }
  }

  if (processedBatches >= maxBatches) {
    console.log(`Backfill paused after ${processedBatches} batches. Run again to continue.`)
    break
  }
}

console.log(`Backfill worker finished. batches=${processedBatches}`)
