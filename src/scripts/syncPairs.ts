import { getDatabase } from "../db/connection.js"
import { upsertPairs } from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import {
  marketIndexToPairConfigs,
  readMarketIndexFromFile,
  readMarketIndexFromUrl
} from "../services/marketIndexSync.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { getStringArg, parseArgs } from "./args.js"

const args = parseArgs()
const file = getStringArg(args, "file")
const url = getStringArg(args, "url")

if (!file && !url) {
  console.error("Usage: npm run sync:pairs -- --file ./market/index.json")
  console.error("   or: npm run sync:pairs -- --url https://example.com/market/index.json")
  process.exit(1)
}

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const marketIndex = file
  ? readMarketIndexFromFile(file)
  : await readMarketIndexFromUrl(url!)
const pairs = marketIndexToPairConfigs(marketIndex)

upsertPairs(db, pairs, { preserveRuntimeState: true })
syncConfiguredPairs(db)

console.log(`Synced ${pairs.length} market pairs.`)
console.log("Imported market pairs default to hot=false and backfill=false.")
