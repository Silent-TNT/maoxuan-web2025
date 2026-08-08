import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const chatHandlerUrl = pathToFileURL(path.join(root, 'api/chat-handler.mjs')).href

let cachedChatHandlers = null
async function getChatHandlers() {
  if (!cachedChatHandlers) {
    const mod = await import(chatHandlerUrl)
    cachedChatHandlers = {
      handleChatRequest: mod.handleChatRequest,
      handleChatStreamRequest: mod.handleChatStreamRequest,
    }
  }
  return cachedChatHandlers
}

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
          await loadEnv()
          const { handleChatRequest, handleChatStreamRequest } = await getChatHandlers()
          const body = await readJsonBody(req)
          if (body.stream) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-transform')
            res.flushHeaders?.()
            try {
              const result = await handleChatStreamRequest(
                body,
                (delta) => res.write(`${JSON.stringify({ type: 'delta', delta })}\n`),
              )
              res.end(`${JSON.stringify({ type: 'done', ...result })}\n`)
            } catch (err) {
              res.end(`${JSON.stringify({ type: 'error', error: err.message || 'Server error' })}\n`)
            }
            return
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
