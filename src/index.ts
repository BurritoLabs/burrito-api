import { env } from "./config/env.js"
import { getDatabase } from "./db/connection.js"
import { runMigrations } from "./db/schema.js"
import { buildServer } from "./server.js"
import { syncConfiguredPairs } from "./services/pairsService.js"

const db = getDatabase()
runMigrations(db)
syncConfiguredPairs(db)

const app = await buildServer(db)

await app.listen({
  host: env.HOST,
  port: env.PORT
})

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down Burrito API")
  await app.close()
  db.close()
  process.exit(0)
}

process.once("SIGINT", () => {
  void shutdown("SIGINT")
})

process.once("SIGTERM", () => {
  void shutdown("SIGTERM")
})
