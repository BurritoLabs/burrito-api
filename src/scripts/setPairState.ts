import { getDatabase } from "../db/connection.js"
import { listPairs, updatePairState } from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"
import { syncConfiguredPairs } from "../services/pairsService.js"
import { findPairBySymbolOrAddress } from "../utils/symbols.js"
import { getNumberArg, getStringArg, parseArgs } from "./args.js"

const parseBooleanArg = (value: string | boolean | undefined) => {
  if (value === undefined) return undefined
  if (value === true || value === "true" || value === "1") return true
  if (value === false || value === "false" || value === "0") return false
  throw new Error(`Invalid boolean value: ${String(value)}`)
}

const args = parseArgs()
const pairArg = getStringArg(args, "pair")

if (!pairArg) {
  console.error(
    "Usage: npm run pair:set -- --pair LUNC_USTC --hot true --backfill true --start-height 28790000"
  )
  process.exit(1)
}

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const pair = findPairBySymbolOrAddress(listPairs(db, true), pairArg)
if (!pair) {
  console.error(`Pair not found: ${pairArg}`)
  process.exit(1)
}

const changes = updatePairState(db, pair.pairAddress, {
  enabled: parseBooleanArg(args.get("enabled")),
  backfill: parseBooleanArg(args.get("backfill")),
  hot: parseBooleanArg(args.get("hot")),
  startHeight: getNumberArg(args, "start-height")
})

if (!changes) {
  console.log(`No changes applied to ${pair.symbol} (${pair.pairAddress}).`)
  process.exit(0)
}

console.log(`Updated ${pair.symbol} (${pair.pairAddress}).`)
