import type { PairRecord, TradeInput } from "../types/domain.js"
import type { FetchTradesOptions, TradeProvider } from "./TradeProvider.js"

export class FcdTradeProvider implements TradeProvider {
  readonly name = "fcd"

  async fetchTrades(_pair: PairRecord, _options: FetchTradesOptions): Promise<TradeInput[]> {
    return []
  }
}
