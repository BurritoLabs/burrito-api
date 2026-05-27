import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { getDatabase } from "../db/connection.js"
import { insertTrades } from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import { CandleService } from "../services/CandleService.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { normalizePairAddress } from "../utils/symbols.js"
import { getStringArg, parseArgs } from "./args.js"

const tradeSchema = z.object({
  pairAddress: z.string().min(1),
  txHash: z.string().min(1),
  height: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  baseAmount: z.string().min(1),
  quoteAmount: z.string().min(1),
  price: z.string().min(1),
  volume: z.string().min(1),
  eventIndex: z.number().int().nonnegative(),
  source: z.string().min(1).default("import")
})

const importSchema = z.union([
  z.array(tradeSchema),
  z.object({
    trades: z.array(tradeSchema)
  })
])

const args = parseArgs()
const file = getStringArg(args, "file")
const aggregate = args.get("aggregate") === true || args.get("aggregate") === "true"

if (!file) {
  throw new Error("Usage: npm run import:trades -- --file ./data/trades.json [--aggregate]")
}

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const raw = readFileSync(path.resolve(process.cwd(), file), "utf8")
const parsed = importSchema.parse(JSON.parse(raw))
const trades = (Array.isArray(parsed) ? parsed : parsed.trades).map((trade) => ({
  ...trade,
  pairAddress: normalizePairAddress(trade.pairAddress)
}))
const inserted = insertTrades(db, trades)

console.log(`Imported ${inserted} new trades from ${file}.`)

if (aggregate) {
  const candleService = new CandleService(db)
  const pairAddresses = new Set(trades.map((trade) => trade.pairAddress))
  for (const pairAddress of pairAddresses) {
    const result = candleService.aggregatePair(pairAddress)
    console.log(
      `Aggregated ${result.candleCount} candles for ${pairAddress} from ${result.tradeCount} trades.`
    )
  }
}
