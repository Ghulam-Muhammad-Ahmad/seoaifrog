import '../env.js'
import { Redis } from 'ioredis'

export type RedisOptions = {
  /** If false, connects on first command (avoids crashing the process on import when Redis is down). */
  lazyConnect?: boolean
}

export function createRedisConnection(opts?: RedisOptions): Redis {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  return new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: opts?.lazyConnect ?? true,
  })
}
