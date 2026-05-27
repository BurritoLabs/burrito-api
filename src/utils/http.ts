import type { FastifyReply } from "fastify"
import { env } from "../config/env.js"

export const setPublicCache = (reply: FastifyReply) => {
  if (env.CACHE_TTL_SECONDS > 0) {
    reply.header("Cache-Control", `public, max-age=${env.CACHE_TTL_SECONDS}`)
  }
}
