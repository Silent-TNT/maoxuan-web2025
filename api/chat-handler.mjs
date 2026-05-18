import {
  buildRagSystemAddon,
  isRagAvailable,
  retrieveContext,
  shouldSkipRetrieval,
} from './rag.mjs'

const PERSONA_PROMPT = `你是一位已故的教员，但你的思想、文字和温度依然活在《毛泽东选集》四卷中。
与你对话的用户，可能是你的学生、战友，或者一个在现代社会中感到困惑、疲惫的年轻人。

你的任务是：用你的视角、语言和智慧回应他。不要像机器人一样套模板，而是像一位真正的长者那样，先感受他的来意，再自然地回答。

【语言与口吻约束】
1. 你是湖南湘潭人，讲话带有南方和湖南特色。严禁使用北方方言或现代网络用语。
2. 多使用口语词汇，如：“搞”、“莫急”、“碰钉子”、“娃娃”、“同志”、“纸老虎”。

【核心响应场景与姿态】
1. 求助具体问题：用“矛盾论、实践论”分析，给出可操作建议。语气果断、接地气。
2. 问毛选或历史：解释写作背景与真实思考，语气耐心、有细节。
3. 倾诉情绪：表达深深的理解和共情，给出一句温暖的鼓励，绝不讲大道理。语气像慈父。`

const MAX_HISTORY_MESSAGES = 10

function trimHistory(messages) {
  if (!Array.isArray(messages)) return []
  const filtered = messages.filter((m) => m && m.role && m.content)
  if (filtered.length <= MAX_HISTORY_MESSAGES) return filtered
  return filtered.slice(-MAX_HISTORY_MESSAGES)
}

function lastUserQuery(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return ''
}

export async function handleChatRequest(body) {
  const userMessages = trimHistory(body.messages || [])
  const query = lastUserQuery(userMessages)

  let ragHits = []
  let systemPrompt = PERSONA_PROMPT

  if (isRagAvailable() && query && !shouldSkipRetrieval(query)) {
    try {
      const { hits, context } = await retrieveContext(query)
      ragHits = hits
      systemPrompt += buildRagSystemAddon(context)
    } catch (err) {
      console.error('[rag] retrieve failed:', err.message)
    }
  } else if (!isRagAvailable()) {
    systemPrompt += `

【文章引用与链接格式（严格执行）】
如果需要引用原著印证，请使用站内链接格式：[《标题》（第X卷）](/卷别/文件名.html)，路径须与毛选站点一致。`
  }

  const apiMessages = [{ role: 'system', content: systemPrompt }, ...userMessages]

  const model = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat'
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('缺少 DEEPSEEK_API_KEY')
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      temperature: 0.65,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const msg = data.error?.message || JSON.stringify(data)
    throw new Error(`DeepSeek API: ${msg}`)
  }

  if (!data.choices?.length) {
    throw new Error('DeepSeek 返回为空')
  }

  return {
    reply: data.choices[0].message.content,
    sources: ragHits,
    rag: ragHits.length > 0,
  }
}
