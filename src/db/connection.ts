import { mkdirSync } from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { env } from "../config/env.js"

let singleton: Database.Database | undefined

export const createDatabase = (databasePath = env.DATABASE_PATH) => {
  const directory = path.dirname(databasePath)
  if (databasePath !== ":memory:" && directory) {
    mkdirSync(directory, { recursive: true })
  }

  const db = new Database(databasePath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  return db
}

export const getDatabase = () => {
  singleton ??= createDatabase()
  return singleton
}
