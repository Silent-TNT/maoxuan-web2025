// Vercel Serverless：教员咨询室
import { handleChatRequest } from './chat-handler.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleChatRequest(req.body || {})
    return res.status(200).json(result)
  } catch (error) {
    console.error('[chat]', error)
    return res.status(500).json({ error: error.message || 'Server error' })
  }
}
