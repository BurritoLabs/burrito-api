import { loadPairsConfig } from "../config/pairs.js"
import { normalizePairAddress, toTradingViewSymbol } from "../utils/symbols.js"
import { parseArgs } from "./args.js"

const args = parseArgs()
const strict = args.get("strict") === true || args.get("strict") === "true"
const pairs = loadPairsConfig()
const errors: string[] = []
const warnings: string[] = []
const pairAddresses = new Set<string>()
const symbols = new Set<string>()

for (const pair of pairs) {
  const pairAddress = normalizePairAddress(pair.pairAddress)
  const symbol = toTradingViewSymbol(pair.symbol)

  if (pairAddresses.has(pairAddress)) {
    errors.push(`Duplicate pairAddress: ${pair.pairAddress}`)
  }
  pairAddresses.add(pairAddress)

  if (symbols.has(symbol)) {
    errors.push(`Duplicate TradingView symbol: ${symbol}`)
  }
  symbols.add(symbol)

  if (!pairAddress.startsWith("terra1")) {
    warnings.push(`${pair.symbol}: pairAddress does not look like a Terra address`)
  }

  if (pairAddress.includes("pair_address_here")) {
    warnings.push(`${pair.symbol}: pairAddress is still the placeholder`)
  }

  if (pair.enabled && pair.backfill && pair.startHeight === null) {
    warnings.push(`${pair.symbol}: backfill enabled but startHeight is null`)
  }

  if (pair.baseDecimals < 0 || pair.quoteDecimals < 0) {
    errors.push(`${pair.symbol}: token decimals must be non-negative`)
  }
}

if (!pairs.some((pair) => pair.enabled)) {
  errors.push("No enabled pairs configured.")
}

for (const warning of warnings) {
  console.log(`WARN ${warning}`)
}

for (const error of errors) {
  console.log(`ERROR ${error}`)
}

if (errors.length || (strict && warnings.length)) {
  process.exit(1)
}

console.log(
  `Config valid with ${pairs.length} pairs, ${pairs.filter((pair) => pair.enabled).length} enabled.`
)
