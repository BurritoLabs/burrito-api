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
