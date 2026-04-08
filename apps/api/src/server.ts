import './env.js'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import fp from 'fastify-plugin'
import type { WebSocket as WsSocket } from 'ws'
import { createRedisConnection } from './lib/redis.js'
import { CRAWL_EVENTS_CHANNEL, type CrawlEventMessage } from './lib/crawl-events.js'
import prismaPlugin from './plugins/prisma.js'
import authRoutes from './routes/auth.js'
import projectsRoutes from './routes/projects.js'
import crawlsRoutes from './routes/crawls.js'
import auditsRoutes from './routes/audits.js'
import reportsRoutes from './routes/reports.js'
import accountRoutes from './routes/account.js'
import speedTestsRoutes from './routes/speed-tests.js'

const crawlRooms = new Map<string, Set<WsSocket>>()

async function buildServer() {
  const fastify = Fastify({ logger: true })

  await fastify.register(cookie)
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  })
  await fastify.register(prismaPlugin)
  await fastify.register(
    fp(
      async (f) => {
        f.decorate('authenticate', async (request, reply) => {
          const token = request.cookies.session_token
          if (!token) {
            return reply.status(401).send({ error: 'Unauthorized' })
          }
          const session = await f.prisma.session.findUnique({
            where: { token },
            include: { user: true },
          })
          if (!session || session.expiresAt < new Date()) {
            return reply.status(401).send({ error: 'Unauthorized' })
          }
          request.user = session.user
        })
        f.decorate('broadcastCrawlEvent', (crawlId: string, type: string, data: unknown) => {
          const set = crawlRooms.get(crawlId)
          if (!set?.size) return
          const payload = JSON.stringify({ type, data })
          for (const ws of set) {
            if (ws.readyState === 1) {
              try {
                ws.send(payload)
              } catch {
                /* ignore */
              }
            }
          }
        })
      },
      { name: 'auth-decorators', dependencies: ['prisma'] },
    ),
  )
  await fastify.register(websocket)

  const redisSub = createRedisConnection({ lazyConnect: true })
  fastify.addHook('onClose', async () => {
    try {
      await redisSub.quit()
    } catch {
      /* ignore */
    }
  })

  const isProd = process.env.NODE_ENV === 'production'
  let redisSubscribed = false
  try {
    await redisSub.connect()
    await redisSub.subscribe(CRAWL_EVENTS_CHANNEL)
    redisSubscribed = true
  } catch (err) {
    const msg =
      'Redis is required for crawls/audits (BullMQ) and live crawl WebSocket fan-out. Start: docker compose up -d redis'
    if (isProd) {
      fastify.log.error({ err }, msg)
      throw err
    }
    fastify.log.warn({ err }, `${msg} — continuing in dev so /api (login, etc.) still works.`)
  }
  if (redisSubscribed) {
    redisSub.on('message', (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as CrawlEventMessage
        fastify.broadcastCrawlEvent(parsed.crawlId, parsed.type, parsed.data)
      } catch (e) {
        fastify.log.error({ err: e }, 'crawl event parse')
      }
    })
  }

  fastify.get(
    '/ws/crawls/:crawlId',
    { websocket: true, preHandler: [fastify.authenticate] },
    async (socket, req) => {
      const { crawlId } = req.params as { crawlId: string }
      const userId = req.user!.id

      const crawl = await fastify.prisma.crawlSession.findFirst({
        where: { id: crawlId, project: { userId } },
      })
      if (!crawl) {
        socket.close(4001, 'Not found')
        return
      }

      let set = crawlRooms.get(crawlId)
      if (!set) {
        set = new Set()
        crawlRooms.set(crawlId, set)
      }
      set.add(socket)

      socket.on('close', () => {
        set?.delete(socket)
        if (set && set.size === 0) crawlRooms.delete(crawlId)
      })
    },
  )

  await fastify.register(authRoutes, { prefix: '/api' })
  await fastify.register(projectsRoutes, { prefix: '/api' })
  await fastify.register(crawlsRoutes, { prefix: '/api' })
  await fastify.register(auditsRoutes, { prefix: '/api' })
  await fastify.register(reportsRoutes, { prefix: '/api' })
  await fastify.register(accountRoutes, { prefix: '/api' })
  await fastify.register(speedTestsRoutes, { prefix: '/api' })

  fastify.get('/health', async () => ({ ok: true }))

  return fastify
}

const port = parseInt(process.env.PORT ?? '3001', 10)

buildServer()
  .then((app) =>
    app.listen({ port, host: '0.0.0.0' }).then(() => {
      app.log.info(`listening on ${port}`)
    }),
  )
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
