import type Database from "better-sqlite3"
import type { FastifyInstance } from "fastify"
import { registerDexRoutes } from "./dex.js"
import { registerHealthRoutes } from "./health.js"
import { registerPairRoutes } from "./pairs.js"
import { registerTradingViewRoutes } from "./tradingview.js"

export const registerRoutes = async (app: FastifyInstance, db: Database.Database) => {
  await registerHealthRoutes(app, db)
  await registerPairRoutes(app, db)
  await registerDexRoutes(app, db)
  await registerTradingViewRoutes(app, db)
}
