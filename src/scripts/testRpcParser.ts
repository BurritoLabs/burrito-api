import assert from "node:assert/strict"
import type { PairRecord } from "../types/domain.js"
import { parseRpcSwapTrades } from "../providers/rpcUtils.js"
import type { TxSearchResult } from "../providers/rpcTypes.js"

const pair: PairRecord = {
  symbol: "LUNC/USTC",
  pairAddress: "terra_pair_address_here",
  base: "uluna",
  quote: "uusd",
  baseDecimals: 6,
  quoteDecimals: 6,
  dex: "terraswap",
  enabled: true,
  startHeight: 28700000,
  backfill: true,
  createdAt: 0,
  updatedAt: 0
}

const tx: TxSearchResult = {
  hash: "ABC123",
  height: "28700001",
  index: 0,
  tx_result: {
    events: [
      {
        type: "wasm",
        attributes: [
          { key: "_contract_address", value: "terra_pair_address_here" },
          { key: "action", value: "swap" },
          { key: "offer_asset", value: "uluna" },
          { key: "ask_asset", value: "uusd" },
          { key: "offer_amount", value: "1000000" },
          { key: "return_amount", value: "25" }
        ]
      }
    ]
  }
}

const [trade] = parseRpcSwapTrades({
  pair,
  timestamp: 1779840000,
  tx
})

assert.ok(trade)
assert.equal(trade.pairAddress, pair.pairAddress)
assert.equal(trade.txHash, "ABC123")
assert.equal(trade.height, 28700001)
assert.equal(trade.baseAmount, "1")
assert.equal(trade.quoteAmount, "0.000025")
assert.equal(trade.price, "0.000025")
assert.equal(trade.volume, "0.000025")
assert.equal(trade.eventIndex, 0)

console.log("RPC parser test passed.")

const mixedDecimalsPair: PairRecord = {
  ...pair,
  symbol: "LUNC/TOKEN8",
  quote: "terra_token8",
  quoteDecimals: 8
}

const mixedDecimalsTx: TxSearchResult = {
  hash: "DEF456",
  height: "28700002",
  index: 0,
  tx_result: {
    events: [
      {
        type: "wasm",
        attributes: [
          { key: "_contract_address", value: "terra_pair_address_here" },
          { key: "action", value: "swap" },
          { key: "offer_asset", value: "uluna" },
          { key: "ask_asset", value: "terra_token8" },
          { key: "offer_amount", value: "1000000" },
          { key: "return_amount", value: "123456789" }
        ]
      }
    ]
  }
}

const [mixedDecimalsTrade] = parseRpcSwapTrades({
  pair: mixedDecimalsPair,
  timestamp: 1779840600,
  tx: mixedDecimalsTx
})

assert.ok(mixedDecimalsTrade)
assert.equal(mixedDecimalsTrade.baseAmount, "1")
assert.equal(mixedDecimalsTrade.quoteAmount, "1.23456789")
assert.equal(mixedDecimalsTrade.price, "1.23456789")
assert.equal(mixedDecimalsTrade.volume, "1.23456789")

console.log("RPC decimal normalization test passed.")
