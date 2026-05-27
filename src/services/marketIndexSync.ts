import { readFileSync } from "node:fs"
import { z } from "zod"
import type { PairConfig } from "../types/domain.js"
import { normalizePairAddress } from "../utils/symbols.js"

const poolAssetSchema = z.object({
  id: z.string().min(1).optional()
})

const marketPairSchema = z.object({
  pair: z.string().min(1),
  dexId: z.string().min(1),
  dexLabel: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  assets: z.array(z.string().min(1)).min(2).optional(),
  poolAssets: z.array(poolAssetSchema).min(2).optional()
})

const marketIndexSchema = z.object({
  pairs: z.array(marketPairSchema)
})

type MarketPair = z.infer<typeof marketPairSchema>

const normalizeAssetId = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.startsWith("native:")) return normalizeAssetId(trimmed.slice("native:".length))
  if (trimmed.startsWith("cw20:")) return normalizeAssetId(trimmed.slice("cw20:".length))
  if (trimmed.startsWith("ibc/")) return `ibc/${trimmed.slice(4).toUpperCase()}`
  return trimmed.toLowerCase()
}

const symbolForAsset = (asset: string) => {
  const normalized = normalizeAssetId(asset)
  if (normalized === "uluna") return "LUNC"
  if (normalized === "uusd") return "USTC"
  if (normalized.startsWith("terra1")) return `CW20-${normalized.slice(6, 10).toUpperCase()}`
  if (normalized.startsWith("ibc/")) return `IBC-${normalized.slice(4, 10)}`
  if (normalized.startsWith("u") && normalized.length === 4) {
    return `${normalized.slice(1, 3).toUpperCase()}TC`
  }
  return normalized.toUpperCase()
}

const decimalsForAsset = (_asset: string) => 6

const resolvePairAssets = (pair: MarketPair): [string, string] | undefined => {
  const assets = pair.assets?.slice(0, 2)
  if (assets?.length === 2) return [assets[0], assets[1]]

  const poolAssets = pair.poolAssets
    ?.map((asset) => asset.id)
    .filter((asset): asset is string => Boolean(asset))
    .slice(0, 2)
  if (poolAssets?.length === 2) return [poolAssets[0], poolAssets[1]]

  return undefined
}

const makeUniqueSymbols = (pairs: PairConfig[]) => {
  const counts = new Map<string, number>()
  for (const pair of pairs) {
    counts.set(pair.symbol, (counts.get(pair.symbol) ?? 0) + 1)
  }

  return pairs.map((pair) => {
    if ((counts.get(pair.symbol) ?? 0) <= 1) return pair
    return {
      ...pair,
      symbol: `${pair.symbol}:${pair.pairAddress.slice(-6).toUpperCase()}`
    }
  })
}

export const marketIndexToPairConfigs = (input: unknown): PairConfig[] => {
  const index = marketIndexSchema.parse(input)
  const pairs: PairConfig[] = []
  const seenAddresses = new Set<string>()

  for (const pair of index.pairs) {
    const pairAddress = normalizePairAddress(pair.pair)
    if (seenAddresses.has(pairAddress)) continue

    const assets = resolvePairAssets(pair)
    if (!assets) continue
    const [base, quote] = assets.map(normalizeAssetId)
    if (!base || !quote) continue

    seenAddresses.add(pairAddress)
    pairs.push({
      symbol: `${symbolForAsset(base)}/${symbolForAsset(quote)}@${pair.dexId}`,
      pairAddress,
      base,
      quote,
      baseDecimals: decimalsForAsset(base),
      quoteDecimals: decimalsForAsset(quote),
      dex: pair.dexId,
      dexLabel: pair.dexLabel ?? pair.dexId,
      type: pair.type ?? "xyk",
      enabled: true,
      startHeight: null,
      backfill: false,
      hot: false,
      source: "market-index"
    })
  }

  return makeUniqueSymbols(pairs)
}

export const readMarketIndexFromFile = (filePath: string) =>
  JSON.parse(readFileSync(filePath, "utf8")) as unknown

export const readMarketIndexFromUrl = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch market index: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as unknown
}
