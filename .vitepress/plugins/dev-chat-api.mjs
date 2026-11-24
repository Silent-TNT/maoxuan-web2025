import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** 本地 docs:dev 时把 /api/chat 转到 chat-handler（需已构建 rag-index 并配置 .env） */
export function devChatApiPlugin() {
  return {
    name: 'maoxuan-dev-chat-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/chat') return next()
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const { checkRateLimit, isBodyTooLarge, RATE_LIMITED_MESSAGE } = await import('../../api/rate-limit.mjs')
          if (isBodyTooLarge(req)) {
            res.statusCode = 413
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: '请求体过大' }))
            return
          }
          // 本地调试放宽到每分钟 60 次
          const limited = await checkRateLimit(req, { limit: 60 })
          if (!limited.allowed) {
            res.statusCode = 429
            res.setHeader('Retry-After', String(limited.retryAfter))
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: RATE_LIMITED_MESSAGE, retryAfter: limited.retryAfter }))
            return
          }
          await loadEnv()
          const { handleChatRequest, streamChatResponse } = await server.ssrLoadModule('/api/chat-handler.mjs')
          const body = await readJsonBody(req)
          if (body.stream) {
            return await streamChatResponse(req, res, body)
          }
          const result = await handleChatRequest(body)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        } catch (err) {
          console.error('[dev-chat-api]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: err.message || 'Server error' }))
        }
      })
    },
  }
}

let envLoaded = false
async function loadEnv() {
  if (envLoaded) return
  try {
    const dotenv = await import('dotenv')
    dotenv.config({ path: path.join(root, '.env') })
  } catch {
    /* dotenv 可选 */
  }
  envLoaded = true
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
