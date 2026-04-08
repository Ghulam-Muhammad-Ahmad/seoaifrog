import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const createBody = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  rootUrl: z.string().url(),
  description: z.string().optional(),
})

const updateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

function projectDto(p: {
  id: string
  userId: string
  name: string
  domain: string
  rootUrl: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    domain: p.domain,
    rootUrl: p.rootUrl,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/projects', async (request) => {
    const list = await fastify.prisma.project.findMany({
      where: { userId: request.user!.id },
      orderBy: { updatedAt: 'desc' },
    })
    return list.map(projectDto)
  })

  fastify.post('/projects', async (request, reply) => {
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const p = await fastify.prisma.project.create({
      data: {
        userId: request.user!.id,
        name: parsed.data.name,
        domain: parsed.data.domain,
        rootUrl: parsed.data.rootUrl,
        description: parsed.data.description ?? null,
      },
    })
    return projectDto(p)
  })

  fastify.get('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const p = await fastify.prisma.project.findFirst({
      where: { id, userId: request.user!.id },
    })
    if (!p) return reply.status(404).send({ error: 'Not found' })
    return projectDto(p)
  })

  fastify.put('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const existing = await fastify.prisma.project.findFirst({
      where: { id, userId: request.user!.id },
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const p = await fastify.prisma.project.update({
      where: { id },
      data: {
        ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
    })
    return projectDto(p)
  })

  fastify.delete('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const res = await fastify.prisma.project.deleteMany({
      where: { id, userId: request.user!.id },
    })
    if (res.count === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.status(204).send()
  })
}

export default projectsRoutes
