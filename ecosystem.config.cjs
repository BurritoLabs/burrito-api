module.exports = {
  apps: [
    {
      name: "burrito-api",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "burrito-api-realtime-worker",
      script: "dist/workers/realtimeWorker.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
