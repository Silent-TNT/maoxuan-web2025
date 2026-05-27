// Vercel Serverless：教员咨询室
import { handleChatRequest } from './chat-handler.mjs'

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
    const result = await handleChatRequest(parseBody(req))
    return sendJson(res, 200, result)
  } catch (error) {
    console.error('[chat]', error)
    return sendJson(res, 500, { error: error.message || 'Server error' })
  }
}
