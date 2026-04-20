import test from 'node:test'
import assert from 'node:assert/strict'
import { revokeUserSessionsAfterPasswordChange } from './account.js'

test('revokeUserSessionsAfterPasswordChange updates the password and clears existing sessions', async () => {
  const calls: string[] = []
  let updatedUserId = ''
  let updatedPasswordHash = ''
  let deletedUserId = ''

  const prisma = {
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { passwordHash: string } }) => {
        calls.push('user.update')
        updatedUserId = where.id
        updatedPasswordHash = data.passwordHash
        return { id: where.id }
      },
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        calls.push('session.deleteMany')
        deletedUserId = where.userId
        return { count: 3 }
      },
    },
  }

  await revokeUserSessionsAfterPasswordChange(
    prisma as {
      $transaction: (ops: Promise<unknown>[]) => Promise<unknown>
      user: { update: (args: { where: { id: string }; data: { passwordHash: string } }) => Promise<unknown> }
      session: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> }
    },
    'user-123',
    'new-password-hash',
  )

  assert.deepEqual(calls, ['user.update', 'session.deleteMany'])
  assert.equal(updatedUserId, 'user-123')
  assert.equal(updatedPasswordHash, 'new-password-hash')
  assert.equal(deletedUserId, 'user-123')
})
