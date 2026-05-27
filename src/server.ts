import type Database from "better-sqlite3"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import Fastify from "fastify"
import { ZodError } from "zod"
import { env } from "./config/env.js"
import { registerRoutes } from "./routes/index.js"

export const buildServer = async (db: Database.Database) => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  })

  await app.register(cors, {
    origin: true
  })

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Burrito API",
        description: "Lightweight candle and TradingView API for Burrito Market.",
        version: "0.1.0"
      },
      servers: [
        {
          url: `http://${env.HOST}:${env.PORT}`,
          description: "Local server"
        }
      ]
    }
  })

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "validation_error",
        issues: error.issues
      })
    }

    app.log.error(error)
    return reply.code(500).send({
      error: "internal_server_error"
    })
  })

  await registerRoutes(app, db)
  return app
}
