import assert from "node:assert/strict"
import { marketIndexToPairConfigs } from "../services/marketIndexSync.js"

const pairs = marketIndexToPairConfigs({
  pairs: [
    {
      pair: "terra1pool000000000000000000000000000000000001",
      dexId: "terraswap",
      dexLabel: "Terraswap",
      type: "xyk",
      assets: ["uusd", "uluna"]
    },
    {
      pair: "terra1pool000000000000000000000000000000000002",
      dexId: "terraswap",
      dexLabel: "Terraswap",
      type: "xyk",
      poolAssets: [{ id: "native:uusd" }, { id: "native:uluna" }]
    },
    {
      pair: "terra1pool000000000000000000000000000000000003",
      dexId: "weso-defi",
      dexLabel: "WESO DeFi",
      type: "xyk",
      assets: ["cw20:terra1token0000000000000000000000000000000000", "uluna"]
    }
  ]
})

assert.equal(pairs.length, 3)
assert.equal(pairs[0].base, "uusd")
assert.equal(pairs[0].quote, "uluna")
assert.equal(pairs[0].hot, false)
assert.equal(pairs[0].backfill, false)
assert.equal(pairs[0].source, "market-index")
assert.notEqual(pairs[0].symbol, pairs[1].symbol)
assert.equal(pairs[2].base, "terra1token0000000000000000000000000000000000")
assert.equal(pairs[2].dexLabel, "WESO DeFi")

console.log("Market index sync test passed.")
