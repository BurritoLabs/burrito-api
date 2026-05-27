import type Database from "better-sqlite3"
import type { FastifyInstance } from "fastify"
import { listPairs } from "../db/repositories.js"
import { setPublicCache } from "../utils/http.js"
import { toTradingViewSymbol } from "../utils/symbols.js"

export const registerPairRoutes = async (app: FastifyInstance, db: Database.Database) => {
  app.get("/v1/dex/pairs", async (_request, reply) => {
    setPublicCache(reply)
    return {
      pairs: listPairs(db).map((pair) => ({
        ...pair,
        tradingViewSymbol: toTradingViewSymbol(pair.symbol)
      }))
    }
  })
}
