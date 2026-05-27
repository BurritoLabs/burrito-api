import type { PairRecord } from "../types/domain.js"

export const toTradingViewSymbol = (symbol: string) =>
  symbol.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")

export const normalizePairAddress = (pairAddress: string) => pairAddress.trim().toLowerCase()

export const findPairBySymbolOrAddress = (pairs: PairRecord[], value: string) => {
  const normalizedValue = value.trim().toLowerCase()
  const tvValue = toTradingViewSymbol(value)
  return pairs.find(
    (pair) =>
      pair.pairAddress.toLowerCase() === normalizedValue ||
      pair.symbol.toLowerCase() === normalizedValue ||
      toTradingViewSymbol(pair.symbol) === tvValue
  )
}
