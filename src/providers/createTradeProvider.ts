import { env } from "../config/env.js"
import { BinodesTradeProvider } from "./BinodesTradeProvider.js"
import { FcdTradeProvider } from "./FcdTradeProvider.js"
import { RpcEventProvider } from "./RpcEventProvider.js"
import type { TradeProvider } from "./TradeProvider.js"

export const createTradeProvider = (): TradeProvider => {
  if (env.TRADE_PROVIDER === "binodes") return new BinodesTradeProvider()
  if (env.TRADE_PROVIDER === "fcd") return new FcdTradeProvider()
  return new RpcEventProvider()
}
