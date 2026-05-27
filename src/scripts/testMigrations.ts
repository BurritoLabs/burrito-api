import assert from "node:assert/strict"
import { createDatabase } from "../db/connection.js"
import { listPairs } from "../db/repositories.js"
import { runMigrations } from "../db/schema.js"

const db = createDatabase(":memory:")

db.exec(`
  CREATE TABLE pairs (
    pair_address TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    base TEXT NOT NULL,
    quote TEXT NOT NULL,
    base_decimals INTEGER NOT NULL DEFAULT 6,
    quote_decimals INTEGER NOT NULL DEFAULT 6,
    dex TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    start_height INTEGER,
    backfill INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  INSERT INTO pairs (
    pair_address, symbol, base, quote, base_decimals, quote_decimals, dex,
    enabled, start_height, backfill, created_at, updated_at
  )
  VALUES (
    'terra_legacy_pair', 'LUNC/USTC', 'uluna', 'uusd', 6, 6, 'terraswap',
    1, 25945368, 1, 1, 1
  );
`)

runMigrations(db)

const [pair] = listPairs(db, true)
assert.ok(pair)
assert.equal(pair.hot, true)
assert.equal(pair.dexLabel, "terraswap")
assert.equal(pair.type, "xyk")
assert.equal(pair.source, "config")

console.log("Migration compatibility test passed.")
