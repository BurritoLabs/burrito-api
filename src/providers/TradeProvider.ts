import type { PairRecord, TradeInput } from "../types/domain.js"

export type FetchTradesOptions = {
  fromHeight: number
  toHeight: number
}

export interface TradeProvider {
  readonly name: string
  getLatestHeight?(): Promise<number>
  fetchTrades(pair: PairRecord, options: FetchTradesOptions): Promise<TradeInput[]>
}
