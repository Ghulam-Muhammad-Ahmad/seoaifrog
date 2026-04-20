import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const registerBody = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
})

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function userDto(u: {
  id: string
  email: string
  name: string | null
  avatar: string | null
  plan: string
  createdAt: Date
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    plan: u.plan,
    createdAt: u.createdAt.toISOString(),
  }
}

const SESSION_DAYS = 30

export function getSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production',
    maxAge: SESSION_DAYS * 86400,
  }
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const { email, name, password } = parsed.data
    const existing = await fastify.prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(409).send({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await fastify.prisma.user.create({
      data: { email, name: name ?? null, passwordHash },
    })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5)
    await fastify.prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    })

    reply.setCookie('session_token', token, getSessionCookieOptions())

    return { user: userDto(user) }
  })

  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const { email, password } = parsed.data
    const user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user?.passwordHash) return reply.status(401).send({ error: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5)
    await fastify.prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    })

    reply.setCookie('session_token', token, getSessionCookieOptions())

    return { user: userDto(user) }
  })

  fastify.post('/auth/logout', async (request, reply) => {
    const token = request.cookies.session_token
    if (token) {
      await fastify.prisma.session.deleteMany({ where: { token } })
    }
    reply.clearCookie('session_token', { path: '/' })
    return { ok: true }
  })

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    return { user: userDto(request.user!) }
  })
}

export default authRoutes
