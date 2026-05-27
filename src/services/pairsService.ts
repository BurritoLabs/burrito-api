import type Database from "better-sqlite3"
import { loadPairsConfig } from "../config/pairs.js"
import { upsertPairs } from "../db/repositories.js"

export const syncConfiguredPairs = (db: Database.Database) => {
  const pairs = loadPairsConfig()
  upsertPairs(db, pairs)
  return pairs
}
