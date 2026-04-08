import '../env.js'
import { PrismaClient } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const prismaPluginImpl: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient()
  await prisma.$connect()

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect()
  })
}

/** Must use fastify-plugin so `prisma` is visible inside prefixed/encapsulated route plugins. */
export default fp(prismaPluginImpl, { name: 'prisma' })
