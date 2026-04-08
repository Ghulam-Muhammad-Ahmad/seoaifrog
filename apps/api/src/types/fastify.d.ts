import type { PrismaClient, User } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    broadcastCrawlEvent: (crawlId: string, type: string, data: unknown) => void
  }

  interface FastifyRequest {
    user?: User
  }
}
