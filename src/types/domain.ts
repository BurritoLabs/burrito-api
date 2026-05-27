export const candleIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"] as const

export type CandleInterval = (typeof candleIntervals)[number]

export const intervalSeconds: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60
}

export type PairConfig = {
  symbol: string
  pairAddress: string
  base: string
  quote: string
  baseDecimals: number
  quoteDecimals: number
  dex: string
  enabled: boolean
  startHeight: number | null
  backfill: boolean
}

export type PairRecord = PairConfig & {
  createdAt: number
  updatedAt: number
}

export type TradeInput = {
  pairAddress: string
  txHash: string
  height: number
  timestamp: number
  baseAmount: string
  quoteAmount: string
  price: string
  volume: string
  eventIndex: number
  source: string
}

export type TradeRecord = TradeInput & {
  id: number
  createdAt: number
}

export type CandleRecord = {
  id: number
  pairAddress: string
  interval: CandleInterval
  time: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  tradeCount: number
  updatedAt: number
}

export type SyncStateRecord = {
  pairAddress: string
  worker: string
  lastHeight: number
  lastTimestamp: number | null
  updatedAt: number
}
