import type Database from "better-sqlite3"

type TableInfoRow = {
  name: string
}

const ensurePairsSchema = (db: Database.Database) => {
  const columns = db.prepare("PRAGMA table_info(pairs)").all() as TableInfoRow[]
  const columnNames = new Set(columns.map((column) => column.name))

  if (columns.length && !columnNames.has("base_decimals")) {
    db.exec("ALTER TABLE pairs ADD COLUMN base_decimals INTEGER NOT NULL DEFAULT 6;")
  }
  if (columns.length && !columnNames.has("quote_decimals")) {
    db.exec("ALTER TABLE pairs ADD COLUMN quote_decimals INTEGER NOT NULL DEFAULT 6;")
  }
  if (columns.length && !columnNames.has("dex_label")) {
    db.exec("ALTER TABLE pairs ADD COLUMN dex_label TEXT NOT NULL DEFAULT '';")
  }
  if (columns.length && !columnNames.has("pool_type")) {
    db.exec("ALTER TABLE pairs ADD COLUMN pool_type TEXT NOT NULL DEFAULT 'xyk';")
  }
  if (columns.length && !columnNames.has("hot")) {
    db.exec("ALTER TABLE pairs ADD COLUMN hot INTEGER NOT NULL DEFAULT 1;")
  }
  if (columns.length && !columnNames.has("source")) {
    db.exec("ALTER TABLE pairs ADD COLUMN source TEXT NOT NULL DEFAULT 'config';")
  }
  if (columns.length && !columnNames.has("discovered_at")) {
    db.exec("ALTER TABLE pairs ADD COLUMN discovered_at INTEGER NOT NULL DEFAULT 0;")
  }
}

const ensureSyncStateSchema = (db: Database.Database) => {
  const columns = db.prepare("PRAGMA table_info(sync_state)").all() as TableInfoRow[]
  const hasWorkerColumn = columns.some((column) => column.name === "worker")

  if (columns.length > 0 && !hasWorkerColumn) {
    db.exec(`
      ALTER TABLE sync_state RENAME TO sync_state_legacy;
    `)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      pair_address TEXT NOT NULL,
      worker TEXT NOT NULL,
      last_height INTEGER NOT NULL,
      last_timestamp INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(pair_address, worker)
    );
  `)

  if (columns.length > 0 && !hasWorkerColumn) {
    db.exec(`
      INSERT OR IGNORE INTO sync_state (
        pair_address, worker, last_height, last_timestamp, updated_at
      )
      SELECT pair_address, 'realtime', last_height, last_timestamp, updated_at
      FROM sync_state_legacy;

      DROP TABLE sync_state_legacy;
    `)
  }
}

export const runMigrations = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pairs (
      pair_address TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      base TEXT NOT NULL,
      quote TEXT NOT NULL,
      base_decimals INTEGER NOT NULL DEFAULT 6,
      quote_decimals INTEGER NOT NULL DEFAULT 6,
      dex TEXT NOT NULL,
      dex_label TEXT NOT NULL DEFAULT '',
      pool_type TEXT NOT NULL DEFAULT 'xyk',
      enabled INTEGER NOT NULL DEFAULT 1,
      start_height INTEGER,
      backfill INTEGER NOT NULL DEFAULT 1,
      hot INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'config',
      discovered_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY,
      pair_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      height INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      base_amount TEXT NOT NULL,
      quote_amount TEXT NOT NULL,
      price TEXT NOT NULL,
      volume TEXT NOT NULL,
      event_index INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(pair_address, tx_hash, event_index)
    );

    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY,
      pair_address TEXT NOT NULL,
      interval TEXT NOT NULL,
      time INTEGER NOT NULL,
      open TEXT NOT NULL,
      high TEXT NOT NULL,
      low TEXT NOT NULL,
      close TEXT NOT NULL,
      volume TEXT NOT NULL,
      trade_count INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(pair_address, interval, time)
    );

    CREATE INDEX IF NOT EXISTS idx_trades_pair_timestamp ON trades(pair_address, timestamp);
    CREATE INDEX IF NOT EXISTS idx_trades_pair_height ON trades(pair_address, height);
    CREATE INDEX IF NOT EXISTS idx_candles_pair_interval_time ON candles(pair_address, interval, time);
  `)

  ensurePairsSchema(db)
  ensureSyncStateSchema(db)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pairs_enabled ON pairs(enabled);
    CREATE INDEX IF NOT EXISTS idx_pairs_hot ON pairs(enabled, hot);
    CREATE INDEX IF NOT EXISTS idx_pairs_dex ON pairs(dex);
  `)
}
