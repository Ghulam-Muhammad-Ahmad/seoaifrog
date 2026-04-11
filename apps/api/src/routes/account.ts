import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import OpenAI from 'openai'
import { z } from 'zod'
import { decryptUserSecret, encryptUserSecret } from '../lib/accountCrypto.js'
import { runPageSpeed } from '../lib/pagespeed.js'

const profilePatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  avatar: z.union([z.string().url().max(2048), z.null()]).optional(),
})

const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

const openaiKeyBody = z.object({
  apiKey: z.string().min(1).max(4096),
})
const pagespeedKeyBody = z.object({
  apiKey: z.string().min(1).max(4096),
})

const openaiKeyTestBody = z.object({
  apiKey: z.string().min(1).max(4096).optional(),
})

const googlePsiOauthBody = z.object({
  accessToken: z.string().min(1).max(8192),
  refreshToken: z.string().min(1).max(8192).optional(),
  expiresInSec: z.number().int().positive().max(31_536_000).optional(),
})

function settingsUserDto(u: {
  id: string
  email: string
  name: string | null
  avatar: string | null
  plan: string
  createdAt: Date
  updatedAt: Date
  openAiKeyConfigured: boolean
  pageSpeedKeyConfigured: boolean
  googlePsiConfigured: boolean
  googlePsiTokenExpiresAt: Date | null
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    plan: u.plan,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    openAiKeyConfigured: u.openAiKeyConfigured,
    pageSpeedKeyConfigured: u.pageSpeedKeyConfigured,
    googlePsiConfigured: u.googlePsiConfigured,
    googlePsiTokenExpiresAt: u.googlePsiTokenExpiresAt?.toISOString() ?? null,
  }
}

async function testOpenAiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
  try {
    const client = new OpenAI({ apiKey })
    await client.models.list()
    return { valid: true, message: 'API key is valid' }
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number }
    const msg =
      typeof err?.message === 'string' && err.message.length > 0
        ? err.message
        : 'OpenAI request failed'
    return { valid: false, message: msg }
  }
}

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  function encryptionKeyOr503(reply: FastifyReply) {
    const k = process.env.ACCOUNT_ENCRYPTION_KEY?.trim()
    if (!k) {
      reply.status(503).send({ error: 'Server encryption is not configured' })
      return null
    }
    return k
  }

  fastify.get('/account/settings', async (request) => {
    const u = await fastify.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        openaiApiKeyEnc: true,
        pagespeedApiKeyEnc: true,
        googlePsiConnection: {
          select: {
            id: true,
            tokenExpiresAt: true,
          },
        },
      },
    })
    if (!u) return { user: null }
    const { openaiApiKeyEnc, pagespeedApiKeyEnc, googlePsiConnection, ...rest } = u
    return {
      user: settingsUserDto({
        ...rest,
        openAiKeyConfigured: Boolean(openaiApiKeyEnc),
        pageSpeedKeyConfigured: Boolean(pagespeedApiKeyEnc),
        googlePsiConfigured: Boolean(googlePsiConnection),
        googlePsiTokenExpiresAt: googlePsiConnection?.tokenExpiresAt ?? null,
      }),
    }
  })

  fastify.patch('/account/profile', async (request, reply) => {
    const parsed = profilePatchBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const { name, email, avatar } = parsed.data
    if (name === undefined && email === undefined && avatar === undefined) {
      return reply.status(400).send({ error: 'No fields to update' })
    }

    if (email !== undefined && email !== request.user!.email) {
      const taken = await fastify.prisma.user.findUnique({ where: { email } })
      if (taken) return reply.status(409).send({ error: 'Email already in use' })
    }

    const updated = await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        openaiApiKeyEnc: true,
        pagespeedApiKeyEnc: true,
        googlePsiConnection: {
          select: {
            id: true,
            tokenExpiresAt: true,
          },
        },
      },
    })
    const { openaiApiKeyEnc, pagespeedApiKeyEnc, googlePsiConnection, ...rest } = updated
    return {
      user: settingsUserDto({
        ...rest,
        openAiKeyConfigured: Boolean(openaiApiKeyEnc),
        pageSpeedKeyConfigured: Boolean(pagespeedApiKeyEnc),
        googlePsiConfigured: Boolean(googlePsiConnection),
        googlePsiTokenExpiresAt: googlePsiConnection?.tokenExpiresAt ?? null,
      }),
    }
  })

  fastify.post('/account/change-password', async (request, reply) => {
    const parsed = changePasswordBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { passwordHash: true },
    })
    if (!user?.passwordHash) {
      return reply.status(400).send({ error: 'Password change is not available for this account' })
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
    if (!ok) return reply.status(401).send({ error: 'Current password is incorrect' })

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
    await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { passwordHash },
    })
    return { ok: true }
  })

  fastify.post('/account/openai-key', async (request, reply) => {
    const parsed = openaiKeyBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const key = encryptionKeyOr503(reply)
    if (!key) return

    let enc: string
    try {
      enc = encryptUserSecret(parsed.data.apiKey, key)
    } catch (e: unknown) {
      fastify.log.error({ err: e }, 'encrypt openai key')
      return reply.status(500).send({ error: 'Could not store API key' })
    }

    const updated = await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { openaiApiKeyEnc: enc },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        openaiApiKeyEnc: true,
        pagespeedApiKeyEnc: true,
        googlePsiConnection: {
          select: {
            id: true,
            tokenExpiresAt: true,
          },
        },
      },
    })
    const { openaiApiKeyEnc, pagespeedApiKeyEnc, googlePsiConnection, ...rest } = updated
    return {
      user: settingsUserDto({
        ...rest,
        openAiKeyConfigured: Boolean(openaiApiKeyEnc),
        pageSpeedKeyConfigured: Boolean(pagespeedApiKeyEnc),
        googlePsiConfigured: Boolean(googlePsiConnection),
        googlePsiTokenExpiresAt: googlePsiConnection?.tokenExpiresAt ?? null,
      }),
    }
  })

  fastify.delete('/account/openai-key', async (request) => {
    const updated = await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { openaiApiKeyEnc: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        openaiApiKeyEnc: true,
        pagespeedApiKeyEnc: true,
        googlePsiConnection: {
          select: {
            id: true,
            tokenExpiresAt: true,
          },
        },
      },
    })
    const { openaiApiKeyEnc, pagespeedApiKeyEnc, googlePsiConnection, ...rest } = updated
    return {
      user: settingsUserDto({
        ...rest,
        openAiKeyConfigured: Boolean(openaiApiKeyEnc),
        pageSpeedKeyConfigured: Boolean(pagespeedApiKeyEnc),
        googlePsiConfigured: Boolean(googlePsiConnection),
        googlePsiTokenExpiresAt: googlePsiConnection?.tokenExpiresAt ?? null,
      }),
    }
  })

  fastify.post('/account/openai-key/test', async (request, reply) => {
    const parsed = openaiKeyTestBody.safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    let apiKey: string | undefined = parsed.data.apiKey

    if (!apiKey) {
      const row = await fastify.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { openaiApiKeyEnc: true },
      })
      if (!row?.openaiApiKeyEnc) {
        return reply.status(400).send({ error: 'No API key provided and none saved for this account' })
      }
      const master = encryptionKeyOr503(reply)
      if (!master) return
      try {
        apiKey = decryptUserSecret(row.openaiApiKeyEnc, master)
      } catch (e: unknown) {
        fastify.log.error({ err: e }, 'decrypt openai key for test')
        return reply.status(500).send({ error: 'Could not read saved API key' })
      }
    }

    const result = await testOpenAiKey(apiKey)
    return { valid: result.valid, message: result.message }
  })

  fastify.post('/account/pagespeed-key', async (request, reply) => {
    const parsed = pagespeedKeyBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const key = encryptionKeyOr503(reply)
    if (!key) return

    let enc: string
    try {
      enc = encryptUserSecret(parsed.data.apiKey, key)
    } catch (e: unknown) {
      fastify.log.error({ err: e }, 'encrypt pagespeed key')
      return reply.status(500).send({ error: 'Could not store PageSpeed API key' })
    }
    await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { pagespeedApiKeyEnc: enc },
    })
    return { ok: true }
  })

  fastify.delete('/account/pagespeed-key', async (request) => {
    await fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { pagespeedApiKeyEnc: null },
    })
    return { ok: true }
  })

  fastify.post('/account/pagespeed-key/test', async (request, reply) => {
    const parsed = pagespeedKeyBody.partial().safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const key = encryptionKeyOr503(reply)
    if (!key) return

    let apiKey = parsed.data.apiKey
    if (!apiKey) {
      const row = await fastify.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { pagespeedApiKeyEnc: true },
      })
      if (!row?.pagespeedApiKeyEnc) {
        return reply.status(400).send({ error: 'No PageSpeed API key provided and none saved for this account' })
      }
      try {
        apiKey = decryptUserSecret(row.pagespeedApiKeyEnc, key)
      } catch (e: unknown) {
        fastify.log.error({ err: e }, 'decrypt pagespeed key')
        return reply.status(500).send({ error: 'Could not read saved PageSpeed API key' })
      }
    }

    try {
      await runPageSpeed({
        url: 'https://example.com/',
        strategy: 'mobile',
        apiKey,
      })
      return { valid: true, message: 'PageSpeed API key is valid' }
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number }
      return reply
        .status(err.statusCode && err.statusCode >= 400 ? err.statusCode : 400)
        .send({ valid: false, error: err.message ?? 'PageSpeed API key validation failed' })
    }
  })

  fastify.post('/account/google-psi-oauth', async (request, reply) => {
    const parsed = googlePsiOauthBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const key = encryptionKeyOr503(reply)
    if (!key) return

    let accessTokenEnc: string
    let refreshTokenEnc: string | null = null
    try {
      accessTokenEnc = encryptUserSecret(parsed.data.accessToken, key)
      refreshTokenEnc = parsed.data.refreshToken ? encryptUserSecret(parsed.data.refreshToken, key) : null
    } catch (e: unknown) {
      fastify.log.error({ err: e }, 'encrypt google oauth token')
      return reply.status(500).send({ error: 'Could not store Google OAuth token' })
    }

    const tokenExpiresAt =
      parsed.data.expiresInSec != null ? new Date(Date.now() + parsed.data.expiresInSec * 1000) : null

    await fastify.prisma.googlePsiConnection.upsert({
      where: { userId: request.user!.id },
      create: {
        userId: request.user!.id,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
      },
      update: {
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
      },
    })

    return {
      ok: true,
      message: 'Google OAuth token saved.',
      googlePsiConfigured: true,
      googlePsiTokenExpiresAt: tokenExpiresAt?.toISOString() ?? null,
    }
  })

  fastify.delete('/account/google-psi-oauth', async (request) => {
    await fastify.prisma.googlePsiConnection.deleteMany({
      where: { userId: request.user!.id },
    })
    return { ok: true, googlePsiConfigured: false, googlePsiTokenExpiresAt: null }
  })

  fastify.post('/account/google-psi-oauth/test', async (request, reply) => {
    const key = encryptionKeyOr503(reply)
    if (!key) return

    const row = await fastify.prisma.googlePsiConnection.findUnique({
      where: { userId: request.user!.id },
      select: { accessTokenEnc: true, tokenExpiresAt: true },
    })
    if (!row?.accessTokenEnc) {
      return reply.status(400).send({ error: 'Google OAuth is not connected for this account' })
    }

    let accessToken: string
    try {
      accessToken = decryptUserSecret(row.accessTokenEnc, key)
    } catch (e: unknown) {
      fastify.log.error({ err: e }, 'decrypt google oauth token')
      return reply.status(500).send({ error: 'Could not read saved Google OAuth token' })
    }

    if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now()) {
      return reply.status(401).send({ error: 'Saved Google OAuth token has expired. Reconnect your account.' })
    }

    try {
      await runPageSpeed({
        url: 'https://example.com/',
        strategy: 'mobile',
        accessToken,
      })
      return { valid: true, message: 'Google OAuth token is valid for PageSpeed Insights' }
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number }
      return reply
        .status(err.statusCode && err.statusCode >= 400 ? err.statusCode : 400)
        .send({ valid: false, error: err.message ?? 'Google OAuth validation failed' })
    }
  })
}

export default accountRoutes
