import type { PairRecord, TradeInput } from "../types/domain.js"
import { decimal } from "../utils/decimal.js"
import { floorTimeToInterval, nowUnixSeconds } from "../utils/time.js"

export const generateSampleTrades = (pair: PairRecord, count = 720): TradeInput[] => {
  const startTime = floorTimeToInterval(nowUnixSeconds() - count * 300, "5m")
  const trades: TradeInput[] = []

  for (let i = 0; i < count; i += 1) {
    const timestamp = startTime + i * 300
    const wave = Math.sin(i / 18) * 0.0012
    const drift = i * 0.000001
    const price = decimal(0.0195 + wave + drift).toDecimalPlaces(8)
    const baseAmount = decimal(100000 + (i % 23) * 1750)
    const quoteAmount = baseAmount.mul(price).toDecimalPlaces(8)

    trades.push({
      pairAddress: pair.pairAddress,
      txHash: `sample-${pair.pairAddress}-${i}`,
      height: 28700000 + i,
      timestamp,
      baseAmount: baseAmount.toString(),
      quoteAmount: quoteAmount.toString(),
      price: price.toString(),
      volume: quoteAmount.toString(),
      eventIndex: 0,
      source: "sample"
    })
  }

  return trades
}
