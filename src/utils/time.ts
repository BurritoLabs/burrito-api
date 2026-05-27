import type { CandleInterval } from "../types/domain.js"
import { intervalSeconds } from "../types/domain.js"

export const nowUnixSeconds = () => Math.floor(Date.now() / 1000)

export const floorTimeToInterval = (timestamp: number, interval: CandleInterval) => {
  const seconds = intervalSeconds[interval]
  return Math.floor(timestamp / seconds) * seconds
}
