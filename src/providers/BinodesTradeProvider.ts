import type { PairRecord, TradeInput } from "../types/domain.js"
import type { FetchTradesOptions, TradeProvider } from "./TradeProvider.js"

export class BinodesTradeProvider implements TradeProvider {
  readonly name = "binodes"

  async fetchTrades(_pair: PairRecord, _options: FetchTradesOptions): Promise<TradeInput[]> {
    throw new Error(
      "BinodesTradeProvider is not implemented yet. Use TRADE_PROVIDER=rpc or import normalized trades."
    )
  }
}
