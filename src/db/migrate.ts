import { getDatabase } from "./connection.js"
import { runMigrations } from "./schema.js"

const db = getDatabase()
runMigrations(db)

console.log("Database migrations completed.")
