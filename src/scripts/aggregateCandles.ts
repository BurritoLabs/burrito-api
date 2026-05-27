import { getDatabase } from "../db/connection.js"
import { listPairs } from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import { CandleService } from "../services/CandleService.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { normalizePairAddress } from "../utils/symbols.js"
import { getStringArg, parseArgs } from "./args.js"

const args = parseArgs()
const pairArg = getStringArg(args, "pair")

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const candleService = new CandleService(db)
const pairs = listPairs(db, true).filter((pair) =>
  pairArg ? pair.pairAddress === normalizePairAddress(pairArg) : true
)

for (const pair of pairs) {
  const result = candleService.aggregatePair(pair.pairAddress)
  console.log(
    `Aggregated ${result.candleCount} candles for ${pair.symbol} from ${result.tradeCount} trades.`
  )
}

if (!pairs.length) {
  console.log(pairArg ? `No enabled pair found for ${pairArg}.` : "No enabled pairs found.")
}
