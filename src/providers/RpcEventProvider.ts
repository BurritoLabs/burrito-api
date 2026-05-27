import type { PairRecord, TradeInput } from "../types/domain.js"
import type { FetchTradesOptions, TradeProvider } from "./TradeProvider.js"
import { env } from "../config/env.js"
import { parseRpcSwapTrades } from "./rpcUtils.js"
import type { BlockResponse, StatusResponse, TxSearchResponse } from "./rpcTypes.js"

export class RpcEventProvider implements TradeProvider {
  readonly name = "rpc-events"
  private readonly blockTimestampCache = new Map<number, number>()

  constructor(private readonly rpcUrl = env.RPC_URL) {}

  async getLatestHeight() {
    const data = await this.getJson<StatusResponse>("/status")
    const height = Number(data.result?.sync_info?.latest_block_height)
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error("Unable to read latest block height from RPC status.")
    }
    return height
  }

  async fetchTrades(pair: PairRecord, options: FetchTradesOptions): Promise<TradeInput[]> {
    const txs = await this.searchPairTransactions(pair, options)
    const trades: TradeInput[] = []

    for (const tx of txs) {
      const height = Number(tx.height)
      if (!Number.isFinite(height)) continue
      const timestamp = await this.getBlockTimestamp(height)
      trades.push(...parseRpcSwapTrades({ pair, timestamp, tx }))
    }

    return trades
  }

  private async searchPairTransactions(pair: PairRecord, options: FetchTradesOptions) {
    const txs = []
    const query = [
      `wasm._contract_address='${pair.pairAddress}'`,
      `tx.height>=${options.fromHeight}`,
      `tx.height<=${options.toHeight}`
    ].join(" AND ")
    let page = 1

    while (page <= 10) {
      const params = new URLSearchParams({
        query,
        prove: "false",
        page: String(page),
        per_page: "100",
        order_by: "\"asc\""
      })
      const data = await this.getJson<TxSearchResponse>(`/tx_search?${params.toString()}`)
      const pageTxs = data.result?.txs ?? []
      txs.push(...pageTxs)

      const total = Number(data.result?.total_count ?? pageTxs.length)
      if (txs.length >= total || pageTxs.length === 0) break
      page += 1
    }

    return txs
  }

  private async getBlockTimestamp(height: number) {
    const cached = this.blockTimestampCache.get(height)
    if (cached !== undefined) return cached

    const params = new URLSearchParams({
      height: String(height)
    })
    const data = await this.getJson<BlockResponse>(`/block?${params.toString()}`)
    const time = data.result?.block?.header?.time
    if (!time) throw new Error(`Unable to read block timestamp for height ${height}.`)

    const timestamp = Math.floor(new Date(time).getTime() / 1000)
    this.blockTimestampCache.set(height, timestamp)
    return timestamp
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.rpcUrl}${path}`)
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
  }
}
