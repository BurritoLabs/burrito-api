import type { FastifyInstance } from "fastify"
import type Database from "better-sqlite3"
import { env } from "../config/env.js"
import { getDatabaseStats } from "../db/repositories.js"
import { nowUnixSeconds } from "../utils/time.js"

export const registerHealthRoutes = async (app: FastifyInstance, db: Database.Database) => {
  app.get("/v1/health", async () => ({
    ok: true,
    service: "burrito-api",
    version: "0.1.0",
    chainId: env.CHAIN_ID,
    time: nowUnixSeconds()
  }))

  app.get("/v1/stats", async () => ({
    service: "burrito-api",
    chainId: env.CHAIN_ID,
    time: nowUnixSeconds(),
    database: getDatabaseStats(db)
  }))
}
