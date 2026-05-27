import type Database from "better-sqlite3"
import type {
  CandleInterval,
  CandleRecord,
  PairConfig,
  PairRecord,
  SyncStateRecord,
  TradeInput,
  TradeRecord
} from "../types/domain.js"
import { nowUnixSeconds } from "../utils/time.js"
import { normalizePairAddress } from "../utils/symbols.js"

type PairRow = {
  pair_address: string
  symbol: string
  base: string
  quote: string
  base_decimals: number
  quote_decimals: number
  dex: string
  dex_label: string
  pool_type: string
  enabled: number
  start_height: number | null
  backfill: number
  hot: number
  source: string
  discovered_at: number
  created_at: number
  updated_at: number
}

type TradeRow = {
  id: number
  pair_address: string
  tx_hash: string
  height: number
  timestamp: number
  base_amount: string
  quote_amount: string
  price: string
  volume: string
  event_index: number
  source: string
  created_at: number
}

type CandleRow = {
  id: number
  pair_address: string
  interval: CandleInterval
  time: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  trade_count: number
  updated_at: number
}

type SyncStateRow = {
  pair_address: string
  worker: string
  last_height: number
  last_timestamp: number | null
  updated_at: number
}

type CountRow = {
  count: number
}

type LatestTradeRow = {
  height: number | null
  timestamp: number | null
}

type LatestCandleRow = {
  time: number | null
}

const toPairRecord = (row: PairRow): PairRecord => ({
  symbol: row.symbol,
  pairAddress: row.pair_address,
  base: row.base,
  quote: row.quote,
  baseDecimals: row.base_decimals,
  quoteDecimals: row.quote_decimals,
  dex: row.dex,
  dexLabel: row.dex_label || row.dex,
  type: row.pool_type || "xyk",
  enabled: Boolean(row.enabled),
  startHeight: row.start_height,
  backfill: Boolean(row.backfill),
  hot: Boolean(row.hot),
  source: row.source || "config",
  discoveredAt: row.discovered_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const toTradeRecord = (row: TradeRow): TradeRecord => ({
  id: row.id,
  pairAddress: row.pair_address,
  txHash: row.tx_hash,
  height: row.height,
  timestamp: row.timestamp,
  baseAmount: row.base_amount,
  quoteAmount: row.quote_amount,
  price: row.price,
  volume: row.volume,
  eventIndex: row.event_index,
  source: row.source,
  createdAt: row.created_at
})

const toCandleRecord = (row: CandleRow): CandleRecord => ({
  id: row.id,
  pairAddress: row.pair_address,
  interval: row.interval,
  time: row.time,
  open: row.open,
  high: row.high,
  low: row.low,
  close: row.close,
  volume: row.volume,
  tradeCount: row.trade_count,
  updatedAt: row.updated_at
})

export const upsertPairs = (
  db: Database.Database,
  pairs: PairConfig[],
  options: { preserveRuntimeState?: boolean } = {}
) => {
  const now = nowUnixSeconds()
  const conflictRuntimeSet = options.preserveRuntimeState
    ? `
      enabled = pairs.enabled,
      start_height = COALESCE(excluded.start_height, pairs.start_height),
      backfill = pairs.backfill,
      hot = pairs.hot,
    `
    : `
      enabled = excluded.enabled,
      start_height = excluded.start_height,
      backfill = excluded.backfill,
      hot = excluded.hot,
    `
  const statement = db.prepare(`
    INSERT INTO pairs (
      pair_address, symbol, base, quote, base_decimals, quote_decimals, dex, dex_label,
      pool_type, enabled, start_height, backfill, hot, source, discovered_at, created_at, updated_at
    )
    VALUES (
      @pairAddress, @symbol, @base, @quote, @baseDecimals, @quoteDecimals, @dex, @dexLabel,
      @type, @enabled, @startHeight, @backfill, @hot, @source, @discoveredAt, @createdAt, @updatedAt
    )
    ON CONFLICT(pair_address) DO UPDATE SET
      symbol = excluded.symbol,
      base = excluded.base,
      quote = excluded.quote,
      base_decimals = excluded.base_decimals,
      quote_decimals = excluded.quote_decimals,
      dex = excluded.dex,
      dex_label = excluded.dex_label,
      pool_type = excluded.pool_type,
      ${conflictRuntimeSet}
      source = excluded.source,
      discovered_at = CASE
        WHEN pairs.discovered_at > 0 THEN pairs.discovered_at
        ELSE excluded.discovered_at
      END,
      updated_at = excluded.updated_at
  `)

  const transaction = db.transaction((inputPairs: PairConfig[]) => {
    for (const pair of inputPairs) {
      statement.run({
        pairAddress: normalizePairAddress(pair.pairAddress),
        symbol: pair.symbol,
        base: pair.base,
        quote: pair.quote,
        baseDecimals: pair.baseDecimals,
        quoteDecimals: pair.quoteDecimals,
        dex: pair.dex,
        dexLabel: pair.dexLabel,
        type: pair.type,
        enabled: pair.enabled ? 1 : 0,
        startHeight: pair.startHeight,
        backfill: pair.backfill ? 1 : 0,
        hot: pair.hot ? 1 : 0,
        source: pair.source,
        discoveredAt: now,
        createdAt: now,
        updatedAt: now
      })
    }
  })

  transaction(pairs)
}

export const listPairs = (db: Database.Database, enabledOnly = false): PairRecord[] => {
  const rows = enabledOnly
    ? db.prepare("SELECT * FROM pairs WHERE enabled = 1 ORDER BY symbol").all()
    : db.prepare("SELECT * FROM pairs ORDER BY symbol").all()
  return (rows as PairRow[]).map(toPairRecord)
}

export const listHotPairs = (db: Database.Database): PairRecord[] => {
  const rows = db
    .prepare("SELECT * FROM pairs WHERE enabled = 1 AND hot = 1 ORDER BY symbol")
    .all()
  return (rows as PairRow[]).map(toPairRecord)
}

export const updatePairState = (
  db: Database.Database,
  pairAddress: string,
  state: {
    enabled?: boolean
    backfill?: boolean
    hot?: boolean
    startHeight?: number | null
  }
) => {
  const assignments: string[] = []
  const params: Record<string, string | number | null> = {
    pairAddress: normalizePairAddress(pairAddress),
    updatedAt: nowUnixSeconds()
  }

  if (state.enabled !== undefined) {
    assignments.push("enabled = @enabled")
    params.enabled = state.enabled ? 1 : 0
  }
  if (state.backfill !== undefined) {
    assignments.push("backfill = @backfill")
    params.backfill = state.backfill ? 1 : 0
  }
  if (state.hot !== undefined) {
    assignments.push("hot = @hot")
    params.hot = state.hot ? 1 : 0
  }
  if (state.startHeight !== undefined) {
    assignments.push("start_height = @startHeight")
    params.startHeight = state.startHeight
  }

  if (!assignments.length) return 0

  assignments.push("updated_at = @updatedAt")
  const result = db
    .prepare(`UPDATE pairs SET ${assignments.join(", ")} WHERE pair_address = @pairAddress`)
    .run(params)
  return result.changes
}

export const insertTrade = (db: Database.Database, trade: TradeInput) => {
  const result = db
    .prepare(`
      INSERT OR IGNORE INTO trades (
        pair_address, tx_hash, height, timestamp, base_amount, quote_amount,
        price, volume, event_index, source, created_at
      )
      VALUES (
        @pairAddress, @txHash, @height, @timestamp, @baseAmount, @quoteAmount,
        @price, @volume, @eventIndex, @source, @createdAt
      )
    `)
    .run({
      ...trade,
      pairAddress: normalizePairAddress(trade.pairAddress),
      createdAt: nowUnixSeconds()
    })

  return result.changes > 0
}

export const insertTrades = (db: Database.Database, trades: TradeInput[]) => {
  const statement = db.prepare(`
    INSERT OR IGNORE INTO trades (
      pair_address, tx_hash, height, timestamp, base_amount, quote_amount,
      price, volume, event_index, source, created_at
    )
    VALUES (
      @pairAddress, @txHash, @height, @timestamp, @baseAmount, @quoteAmount,
      @price, @volume, @eventIndex, @source, @createdAt
    )
  `)
  const now = nowUnixSeconds()
  let inserted = 0

  const transaction = db.transaction((inputTrades: TradeInput[]) => {
    for (const trade of inputTrades) {
      const result = statement.run({
        ...trade,
        pairAddress: normalizePairAddress(trade.pairAddress),
        createdAt: now
      })
      inserted += result.changes
    }
  })

  transaction(trades)
  return inserted
}

export const listTrades = (
  db: Database.Database,
  options: { pairAddress: string; limit: number; before?: number }
): TradeRecord[] => {
  const pairAddress = normalizePairAddress(options.pairAddress)
  const rows = options.before
    ? db
        .prepare(
          "SELECT * FROM trades WHERE pair_address = ? AND timestamp < ? ORDER BY timestamp DESC, id DESC LIMIT ?"
        )
        .all(pairAddress, options.before, options.limit)
    : db
        .prepare("SELECT * FROM trades WHERE pair_address = ? ORDER BY timestamp DESC, id DESC LIMIT ?")
        .all(pairAddress, options.limit)

  return (rows as TradeRow[]).map(toTradeRecord)
}

export const listAllTradesForPair = (
  db: Database.Database,
  pairAddress: string
): TradeRecord[] => {
  const rows = db
    .prepare("SELECT * FROM trades WHERE pair_address = ? ORDER BY timestamp ASC, id ASC")
    .all(normalizePairAddress(pairAddress))
  return (rows as TradeRow[]).map(toTradeRecord)
}

export const listTradesForPairInTimeRange = (
  db: Database.Database,
  pairAddress: string,
  fromTimestampInclusive: number,
  toTimestampExclusive: number
): TradeRecord[] => {
  const rows = db
    .prepare(
      `SELECT * FROM trades
       WHERE pair_address = ?
         AND timestamp >= ?
         AND timestamp < ?
       ORDER BY timestamp ASC, id ASC`
    )
    .all(normalizePairAddress(pairAddress), fromTimestampInclusive, toTimestampExclusive)
  return (rows as TradeRow[]).map(toTradeRecord)
}

export const upsertCandles = (
  db: Database.Database,
  candles: Array<Omit<CandleRecord, "id" | "updatedAt">>
) => {
  const statement = db.prepare(`
    INSERT INTO candles (
      pair_address, interval, time, open, high, low, close, volume, trade_count, updated_at
    )
    VALUES (
      @pairAddress, @interval, @time, @open, @high, @low, @close, @volume, @tradeCount, @updatedAt
    )
    ON CONFLICT(pair_address, interval, time) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      trade_count = excluded.trade_count,
      updated_at = excluded.updated_at
  `)
  const now = nowUnixSeconds()

  const transaction = db.transaction(
    (inputCandles: Array<Omit<CandleRecord, "id" | "updatedAt">>) => {
      for (const candle of inputCandles) {
        statement.run({
          ...candle,
          pairAddress: normalizePairAddress(candle.pairAddress),
          updatedAt: now
        })
      }
    }
  )

  transaction(candles)
}

export const listCandles = (
  db: Database.Database,
  options: {
    pairAddress: string
    interval: CandleInterval
    limit: number
    before?: number
    from?: number
    to?: number
    ascending?: boolean
  }
): CandleRecord[] => {
  const pairAddress = normalizePairAddress(options.pairAddress)
  const clauses = ["pair_address = @pairAddress", "interval = @interval"]
  const params: Record<string, string | number> = {
    pairAddress,
    interval: options.interval,
    limit: options.limit
  }

  if (options.before !== undefined) {
    clauses.push("time < @before")
    params.before = options.before
  }
  if (options.from !== undefined) {
    clauses.push("time >= @from")
    params.from = options.from
  }
  if (options.to !== undefined) {
    clauses.push("time <= @to")
    params.to = options.to
  }

  const order = options.ascending ? "ASC" : "DESC"
  const rows = db
    .prepare(
      `SELECT * FROM candles WHERE ${clauses.join(" AND ")} ORDER BY time ${order} LIMIT @limit`
    )
    .all(params)

  return (rows as CandleRow[]).map(toCandleRecord)
}

export const getSyncState = (
  db: Database.Database,
  pairAddress: string,
  worker = "realtime"
): SyncStateRecord | undefined => {
  const row = db
    .prepare("SELECT * FROM sync_state WHERE pair_address = ? AND worker = ?")
    .get(normalizePairAddress(pairAddress), worker) as SyncStateRow | undefined
  if (!row) return undefined
  return {
    pairAddress: row.pair_address,
    worker: row.worker,
    lastHeight: row.last_height,
    lastTimestamp: row.last_timestamp,
    updatedAt: row.updated_at
  }
}

export const upsertSyncState = (
  db: Database.Database,
  state: Omit<SyncStateRecord, "updatedAt">
) => {
  db.prepare(`
    INSERT INTO sync_state (pair_address, worker, last_height, last_timestamp, updated_at)
    VALUES (@pairAddress, @worker, @lastHeight, @lastTimestamp, @updatedAt)
    ON CONFLICT(pair_address, worker) DO UPDATE SET
      last_height = excluded.last_height,
      last_timestamp = excluded.last_timestamp,
      updated_at = excluded.updated_at
  `).run({
    ...state,
    pairAddress: normalizePairAddress(state.pairAddress),
    updatedAt: nowUnixSeconds()
  })
}

export const getDatabaseStats = (db: Database.Database) => {
  const pairCount = (
    db.prepare("SELECT COUNT(*) AS count FROM pairs").get() as CountRow
  ).count
  const enabledPairCount = (
    db.prepare("SELECT COUNT(*) AS count FROM pairs WHERE enabled = 1").get() as CountRow
  ).count
  const hotPairCount = (
    db.prepare("SELECT COUNT(*) AS count FROM pairs WHERE enabled = 1 AND hot = 1").get() as CountRow
  ).count
  const tradeCount = (
    db.prepare("SELECT COUNT(*) AS count FROM trades").get() as CountRow
  ).count
  const candleCount = (
    db.prepare("SELECT COUNT(*) AS count FROM candles").get() as CountRow
  ).count
  const latestTrade = db
    .prepare("SELECT height, timestamp FROM trades ORDER BY height DESC, id DESC LIMIT 1")
    .get() as LatestTradeRow | undefined
  const latestCandle = db
    .prepare("SELECT time FROM candles ORDER BY time DESC LIMIT 1")
    .get() as LatestCandleRow | undefined

  return {
    pairs: pairCount,
    enabledPairs: enabledPairCount,
    hotPairs: hotPairCount,
    trades: tradeCount,
    candles: candleCount,
    latestTradeHeight: latestTrade?.height ?? null,
    latestTradeTimestamp: latestTrade?.timestamp ?? null,
    latestCandleTime: latestCandle?.time ?? null
  }
}
