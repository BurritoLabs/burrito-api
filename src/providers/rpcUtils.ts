import { decimal, decimalDiv, decimalShift } from "../utils/decimal.js"
import type { PairRecord, TradeInput } from "../types/domain.js"
import type { TendermintAttribute, TendermintEvent, TxSearchResult } from "./rpcTypes.js"

const maybeDecodeBase64 = (value: string) => {
  if (!value || value.length % 4 !== 0) return value
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return value

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8")
    return /^[\x09\x0A\x0D\x20-\x7E]+$/.test(decoded) ? decoded : value
  } catch {
    return value
  }
}

const decodeAttribute = (attribute: TendermintAttribute) => ({
  key: maybeDecodeBase64(attribute.key),
  value: attribute.value ? maybeDecodeBase64(attribute.value) : ""
})

const toAttributeMap = (event: TendermintEvent) => {
  const map = new Map<string, string>()
  for (const attribute of event.attributes ?? []) {
    const decoded = decodeAttribute(attribute)
    map.set(decoded.key, decoded.value)
  }
  return map
}

const normalizeAsset = (value: string | undefined) => {
  if (!value) return ""
  const trimmed = value.trim().toLowerCase()
  if (trimmed.startsWith("native:")) return normalizeAsset(trimmed.slice("native:".length))
  if (trimmed.startsWith("cw20:")) return normalizeAsset(trimmed.slice("cw20:".length))

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === "object" && parsed !== null) {
      const object = parsed as Record<string, unknown>
      if (typeof object.native_token === "object" && object.native_token !== null) {
        const nativeToken = object.native_token as Record<string, unknown>
        if (typeof nativeToken.denom === "string") return nativeToken.denom.toLowerCase()
      }
      if (typeof object.token === "object" && object.token !== null) {
        const token = object.token as Record<string, unknown>
        if (typeof token.contract_addr === "string") return token.contract_addr.toLowerCase()
      }
    }
  } catch {
    // Non-JSON asset strings are normal in wasm events.
  }

  return trimmed
}

const getAttribute = (attributes: Map<string, string>, keys: string[]) => {
  for (const key of keys) {
    const value = attributes.get(key)
    if (value) return value
  }
  return undefined
}

const isSwapEvent = (attributes: Map<string, string>) => {
  const action = getAttribute(attributes, ["action", "wasm.action"])
  return action?.toLowerCase().includes("swap") ?? false
}

const getSwapAmounts = (pair: PairRecord, attributes: Map<string, string>) => {
  const offerAsset = normalizeAsset(getAttribute(attributes, ["offer_asset", "offer_asset_info"]))
  const askAsset = normalizeAsset(getAttribute(attributes, ["ask_asset", "ask_asset_info"]))
  const offerAmount = getAttribute(attributes, ["offer_amount", "offer_asset_amount"])
  const returnAmount = getAttribute(attributes, ["return_amount", "ask_amount"])

  if (!offerAsset || !askAsset || !offerAmount || !returnAmount) return undefined

  const base = normalizeAsset(pair.base)
  const quote = normalizeAsset(pair.quote)

  if (offerAsset === base && askAsset === quote) {
    return {
      baseAmount: offerAmount,
      quoteAmount: returnAmount
    }
  }

  if (offerAsset === quote && askAsset === base) {
    return {
      baseAmount: returnAmount,
      quoteAmount: offerAmount
    }
  }

  return undefined
}

export const parseRpcSwapTrades = ({
  pair,
  timestamp,
  tx
}: {
  pair: PairRecord
  timestamp: number
  tx: TxSearchResult
}): TradeInput[] => {
  const trades: TradeInput[] = []
  const height = Number(tx.height)

  for (const [eventIndex, event] of (tx.tx_result?.events ?? []).entries()) {
    if (!event.type.includes("wasm")) continue
    const attributes = toAttributeMap(event)
    const contractAddress = getAttribute(attributes, ["_contract_address", "contract_address"])
    if (contractAddress?.toLowerCase() !== pair.pairAddress.toLowerCase()) continue
    if (!isSwapEvent(attributes)) continue

    const amounts = getSwapAmounts(pair, attributes)
    if (!amounts) continue
    if (decimal(amounts.baseAmount).lte(0) || decimal(amounts.quoteAmount).lte(0)) continue

    trades.push({
      pairAddress: pair.pairAddress,
      txHash: tx.hash,
      height,
      timestamp,
      baseAmount: decimalShift(amounts.baseAmount, pair.baseDecimals),
      quoteAmount: decimalShift(amounts.quoteAmount, pair.quoteDecimals),
      price: decimalDiv(
        decimalShift(amounts.quoteAmount, pair.quoteDecimals),
        decimalShift(amounts.baseAmount, pair.baseDecimals)
      ),
      volume: decimalShift(amounts.quoteAmount, pair.quoteDecimals),
      eventIndex,
      source: "rpc-events"
    })
  }

  return trades
}
