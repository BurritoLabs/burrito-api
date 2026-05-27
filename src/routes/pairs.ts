import type Database from "better-sqlite3"
import type { FastifyInstance } from "fastify"
import { listPairs } from "../db/repositories.js"
import { toTradingViewSymbol } from "../utils/symbols.js"

export const registerPairRoutes = async (app: FastifyInstance, db: Database.Database) => {
  app.get("/v1/dex/pairs", async () => ({
    pairs: listPairs(db).map((pair) => ({
      ...pair,
      tradingViewSymbol: toTradingViewSymbol(pair.symbol)
    }))
  }))
}
