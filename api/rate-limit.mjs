/**
 * 限流：配了 Upstash/Vercel KV 就走 KV（多实例共享），否则退回单实例内存计数。
 * 环境变量：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（或 Vercel 的 KV_REST_API_URL / KV_REST_API_TOKEN）
 */
const WINDOW_MS = 60_000
const LIMIT = 12
const MAX_BODY_BYTES = 200 * 1024

const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '')
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
const buckets = new Map()

function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip']
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || '')
    .split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  return ip
}

function checkRateLimitMemory(req, { limit = LIMIT, windowMs = WINDOW_MS } = {}) {
  const now = Date.now()
  const key = clientKey(req)
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 })
    return { allowed: true, remaining: limit - 1 }
  }
  bucket.count++
  if (bucket.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000)) }
  }
  return { allowed: true, remaining: limit - bucket.count }
}

async function checkRateLimitKv(req, { limit = LIMIT, windowMs = WINDOW_MS } = {}) {
  const now = Date.now()
  const windowIndex = Math.floor(now / windowMs)
  const key = `mxchat:rl:${clientKey(req)}:${windowIndex}`
  const response = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, Math.ceil(windowMs / 1000) + 5],
    ]),
    signal: AbortSignal.timeout(1500),
  })
  if (!response.ok) throw new Error(`KV ${response.status}`)
  const payload = await response.json()
  const count = Number(payload?.[0]?.result ?? 0)
  if (count > limit) {
    const resetAt = (windowIndex + 1) * windowMs
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
  }
  return { allowed: true, remaining: Math.max(0, limit - count) }
}

export async function checkRateLimit(req, options) {
  if (!KV_URL || !KV_TOKEN) return checkRateLimitMemory(req, options)
  try {
    return await checkRateLimitKv(req, options)
  } catch (error) {
    console.warn('[rate-limit] KV 不可用，退回内存计数:', error.message)
    return checkRateLimitMemory(req, options)
  }
}

export function isBodyTooLarge(req) {
  const length = Number(req.headers?.['content-length'] || 0)
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

export const RATE_LIMITED_MESSAGE = '问的人多，先歇口气，过一会儿再问。'
