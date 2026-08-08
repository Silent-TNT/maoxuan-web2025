// Vercel Serverless：教员咨询室
import { handleChatRequest, handleChatStreamRequest } from './chat-handler.mjs'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = parseBody(req)
    if (body.stream) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.flushHeaders?.()
      const controller = new AbortController()
      req.on('aborted', () => controller.abort())
      try {
        const result = await handleChatStreamRequest(
          body,
          (delta) => res.write(`${JSON.stringify({ type: 'delta', delta })}\n`),
          controller.signal,
        )
        res.end(`${JSON.stringify({ type: 'done', ...result })}\n`)
      } catch (error) {
        res.end(`${JSON.stringify({ type: 'error', error: error.message || 'Server error' })}\n`)
      }
      return
    }
    const result = await handleChatRequest(body)
    return sendJson(res, 200, result)
  } catch (error) {
    console.error('[chat]', error)
    return sendJson(res, 500, { error: error.message || 'Server error' })
  }
}
