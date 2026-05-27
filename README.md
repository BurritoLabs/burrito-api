# Burrito API v0.1

Lightweight API service for Burrito Market candles and TradingView chart data on Terra Classic.

This project is intentionally not a full chain indexer. It only handles DEX pairs configured in `config/pairs.json`.

## What v0.1 Does

- Stores configured pairs in SQLite.
- Stores swap trades in SQLite.
- Aggregates trades into candles for `1m`, `5m`, `15m`, `1h`, `4h`, and `1d`.
- Serves Burrito Market candle endpoints.
- Serves TradingView UDF-compatible config, symbol search, and history endpoints.
- Includes development sample trades so candle generation can be tested before real chain providers are implemented.
- Imports normalized historical trades from JSON, so historical data can come from Binodes, FCD, Finder, an archive node, or any converter script.

RPC realtime fetching is implemented as a conservative provider. Historical completeness still depends on whether your source can actually return old tx/event data. The Binodes and FCD providers are intentionally fail-closed placeholders until their real response formats are wired in.

## Local Development

```bash
npm install
npm run migrate
npm run seed:sample
npm run dev
```

Server defaults:

```text
http://127.0.0.1:3001
```

Health check:

```bash
curl http://127.0.0.1:3001/v1/health
```

Swagger UI:

```text
http://127.0.0.1:3001/docs
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Important production defaults:

```env
PORT=3001
HOST=127.0.0.1
CHAIN_ID=columbus-5
LCD_URL=http://127.0.0.1:1317
RPC_URL=http://127.0.0.1:26657
DATABASE_PATH=./data/burrito-candles.sqlite
CACHE_TTL_SECONDS=10
RATE_LIMIT_MAX=120
RATE_LIMIT_TIME_WINDOW=1 minute
INDEXER_ENABLED=false
INDEXER_BATCH_BLOCKS=100
INDEXER_CONFIRMATIONS=1
BACKFILL_BATCH_BLOCKS=100
BACKFILL_MAX_BATCHES_PER_RUN=100
BACKFILL_SLEEP_MS=250
TRADE_PROVIDER=rpc
```

Do not expose local RPC or LCD publicly. Public API access should go through Nginx to this service only.

Public read endpoints send `Cache-Control: public, max-age=CACHE_TTL_SECONDS` when the value is greater than `0`.

## Pair Config

Pairs live in `config/pairs.json`:

```json
[
  {
    "symbol": "LUNC/USTC",
    "pairAddress": "terra_PAIR_ADDRESS_HERE",
    "base": "uluna",
    "quote": "uusd",
    "baseDecimals": 6,
    "quoteDecimals": 6,
    "dex": "terraswap",
    "enabled": true,
    "startHeight": null,
    "backfill": true
  }
]
```

For complete historical candles, `startHeight` should be the pair contract creation height, not `0`.

You can try to resolve creation heights from the configured LCD:

```bash
npm run resolve:start-heights
```

This requires `LCD_URL` to be reachable. If your local LCD is not running, the command will fail safely and will not change the config.

To write resolved heights back to `config/pairs.json`:

```bash
npm run resolve:start-heights -- --write
```

If a pair already has `startHeight`, it is left unchanged unless you pass:

```bash
npm run resolve:start-heights -- --write --overwrite
```

## API Endpoints

```text
GET /v1/health
GET /v1/stats
GET /v1/dex/pairs
GET /v1/dex/trades?pair=&limit=&before=
GET /v1/dex/candles?pair=&interval=&limit=&before=&from=&to=&order=
```

Example candles request:

```bash
curl "http://127.0.0.1:3001/v1/dex/candles?pair=terra_PAIR_ADDRESS_HERE&interval=1h&limit=100"
```

The `pair` parameter accepts a pair address, display symbol like `LUNC/USTC`, or TradingView-style symbol like `LUNC_USTC`.

Ascending candles for charting:

```bash
curl "http://127.0.0.1:3001/v1/dex/candles?pair=terra_PAIR_ADDRESS_HERE&interval=1h&from=1700000000&to=1900000000&order=asc&limit=5000"
```

## TradingView UDF Endpoints

```text
GET /v1/tradingview/config
GET /v1/tradingview/symbols?symbol=LUNC_USTC
GET /v1/tradingview/search?query=LUNC
GET /v1/tradingview/history?symbol=LUNC_USTC&resolution=60&from=1700000000&to=1900000000
```

History response with data:

```json
{
  "s": "ok",
  "t": [],
  "o": [],
  "h": [],
  "l": [],
  "c": [],
  "v": []
}
```

History response without data:

```json
{
  "s": "no_data"
}
```

## Commands

```bash
npm run migrate
npm run seed:sample
npm run import:trades -- --file ./data/trades.json --aggregate
npm run aggregate:candles
npm run resolve:start-heights
npm run validate:config
npm run test:candles
npm run test:rpc-parser
npm run dev
npm run build
npm run start
npm run worker:realtime
npm run worker:backfill
```

`worker:realtime` uses the configured provider. With `TRADE_PROVIDER=rpc`, it starts from the current safe height when `startHeight` is `null`, so it does not scan from `0`.

`worker:backfill` only runs for pairs with a real `startHeight`. For complete history, set `startHeight` to the pair contract creation height.

Backfill is intentionally bounded so it can run safely on a node server:

```bash
npm run worker:backfill
npm run worker:backfill -- --pair LUNC_USTC
npm run worker:backfill -- --pair terra_PAIR_ADDRESS_HERE --to-height 28750000
npm run worker:backfill -- --batch-blocks 100 --max-batches 50 --sleep-ms 250
```

`worker:backfill` saves progress in `sync_state` with `worker=backfill`, so you can run it repeatedly until history is complete. It will not overwrite the realtime worker progress.

## Importing Historical Trades

If your local node does not have old tx history, fetch or export historical swaps from an external source and normalize them into this JSON shape.

`baseAmount`, `quoteAmount`, `price`, and `volume` should be normalized decimal values, not raw micro-unit chain integers. The RPC provider normalizes raw chain amounts by `baseDecimals` and `quoteDecimals` from `config/pairs.json`.

```json
{
  "trades": [
    {
      "pairAddress": "terra_PAIR_ADDRESS_HERE",
      "txHash": "ABC123",
      "height": 28700000,
      "timestamp": 1779840000,
      "baseAmount": "1000000",
      "quoteAmount": "20.5",
      "price": "0.0000205",
      "volume": "20.5",
      "eventIndex": 0,
      "source": "external-backfill"
    }
  ]
}
```

Then import and aggregate:

```bash
npm run import:trades -- --file ./data/trades.json --aggregate
```

There is also a sample file:

```bash
npm run import:trades -- --file ./examples/trades.sample.json --aggregate
```

This keeps the API independent from any single history provider.

## Server Deployment To /srv/burrito-api

Install Node.js, Git, Nginx, and PM2 on Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx
npm install -g pm2
```

Clone and build:

```bash
cd /srv
git clone https://github.com/YOUR_USERNAME/burrito-api.git
cd burrito-api
npm install
npm run build
npm run migrate
npm run seed:sample
```

Create `.env`:

```bash
nano .env
```

Use:

```env
PORT=3001
HOST=127.0.0.1
CHAIN_ID=columbus-5
LCD_URL=http://127.0.0.1:1317
RPC_URL=http://127.0.0.1:26657
FCD_URL=
DATABASE_PATH=./data/burrito-candles.sqlite
CACHE_TTL_SECONDS=10
RATE_LIMIT_MAX=120
RATE_LIMIT_TIME_WINDOW=1 minute
INDEXER_ENABLED=false
INDEXER_INTERVAL_SECONDS=10
INDEXER_BATCH_BLOCKS=100
INDEXER_CONFIRMATIONS=1
BACKFILL_BATCH_BLOCKS=100
BACKFILL_MAX_BATCHES_PER_RUN=100
BACKFILL_SLEEP_MS=250
TRADE_PROVIDER=rpc
```

Start with PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

Test locally on the server:

```bash
curl http://127.0.0.1:3001/v1/health
curl http://127.0.0.1:3001/v1/stats
```

## Nginx Reverse Proxy

Copy the example:

```bash
cp nginx-api.burrito.money.example.conf /etc/nginx/sites-available/api.burrito.money
ln -s /etc/nginx/sites-available/api.burrito.money /etc/nginx/sites-enabled/api.burrito.money
nginx -t
systemctl reload nginx
```

Cloudflare DNS:

```text
Type: A
Name: api
Content: your node server IP
Proxy: On
```

Public test:

```text
https://api.burrito.money/v1/health
```

## Updating From GitHub On Server

```bash
cd /srv/burrito-api
git pull
npm install
npm run build
npm run migrate
pm2 restart ecosystem.config.cjs
pm2 status
```

## Next Phase

Trade ingestion has two paths:

```text
Backfill Worker
external history source or archive RPC -> normalized trades -> candles

Realtime Worker
latest height from local node -> new swap events -> trades -> candles
```

If the local node is pruned or does not have historical tx indexes, historical backfill will need an external source such as Binodes, FCD, Finder, or an archive node.
