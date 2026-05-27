import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { loadPairsConfig } from "../config/pairs.js"
import { ContractService } from "../services/ContractService.js"
import { normalizePairAddress } from "../utils/symbols.js"
import { parseArgs } from "./args.js"

const args = parseArgs()
const write = args.get("write") === true || args.get("write") === "true"
const overwrite = args.get("overwrite") === true || args.get("overwrite") === "true"
const configPath = path.resolve(process.cwd(), "config/pairs.json")
const pairs = loadPairsConfig(configPath)
const contractService = new ContractService()

const resolved = new Map<string, number>()

for (const pair of pairs) {
  if (pair.startHeight !== null && !overwrite) {
    console.log(`${pair.symbol}: startHeight already set to ${pair.startHeight}`)
    continue
  }

  try {
    const height = await contractService.getContractCreationHeight(pair.pairAddress)
    if (height === null) {
      console.log(`${pair.symbol}: creation height not found`)
      continue
    }
    resolved.set(pair.pairAddress, height)
    console.log(`${pair.symbol}: ${height}`)
  } catch (error) {
    console.log(
      `${pair.symbol}: failed - ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

if (write && resolved.size) {
  const rawPairs = JSON.parse(readFileSync(configPath, "utf8")) as Array<{
    pairAddress: string
    startHeight?: number | null
  }>

  for (const pair of rawPairs) {
    const normalizedAddress = normalizePairAddress(pair.pairAddress)
    const height = resolved.get(normalizedAddress)
    if (height !== undefined && (pair.startHeight == null || overwrite)) {
      pair.startHeight = height
    }
  }

  writeFileSync(configPath, `${JSON.stringify(rawPairs, null, 2)}\n`)
  console.log(`Updated ${configPath}`)
}

if (write && !resolved.size) {
  console.log("No start heights resolved; config was not changed.")
}
