import fs from 'fs'
import path from 'path'

export const VOLUMES = ['第一卷', '第二卷', '第三卷', '第四卷']

export const RAG_DEFAULTS = {
  chunkSize: 400,
  chunkOverlap: 80,
  topK: 5,
}

export const CHUNK_VERSION = 3
const sentenceSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'sentence' })

export function stripFrontmatter(content) {
  if (!content.startsWith('---')) return { fm: {}, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { fm: {}, body: content }
  const raw = content.slice(4, end)
  const body = content.slice(end + 4).replace(/^\n/, '')
  const fm = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/)
    if (m) fm[m[1]] = m[2].trim()
  }
  return { fm, body }
}

export function parseArticleFile(volume, filename) {
  const base = filename.replace(/\.md$/i, '')
  const m = base.match(/^\d+-(.+)$/)
  const slug = base
  const shortTitle = m ? m[1] : base
  return {
    slug,
    shortTitle,
    path: `/${volume}/${slug}.html`,
  }
}

export function extractDisplayTitle(body, shortTitle) {
  const h1 = body.match(/^#\s+(.+?)\s*$/m)
  if (!h1) return shortTitle
  return h1[1].replace(/\s+/g, ' ').trim().replace(/——.*$/, '').trim() || shortTitle
}

export function normalizeBodyForChunking(body) {
  return body
    .replace(/\r\n/g, '\n')
    .split(/^[ \t　]*(?:#{1,6}[ \t]+)?注[ \t　]*释[ \t　]*[：:]?[ \t　]*$/mu, 1)[0]
    // 题解是 markdown 引用块，页面渲染后看不到 ">" 前缀，索引里也不能留，否则引文永远对不上
    .replace(/^[ \t]*>[ \t]?/gmu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 单句超过目标长度时按句内标点拆开，避免出现 1000 字以上的块（超 embedding 输入上限） */
function splitLongSentence(sentence, size) {
  if (sentence.length <= size) return [sentence]
  const parts = []
  let rest = sentence
  while (rest.length > size) {
    let cut = -1
    for (const match of rest.matchAll(/[，、；：]/gu)) {
      if (match.index >= 20 && match.index <= size - 20 && match.index + 1 > cut) cut = match.index + 1
    }
    if (cut <= 0) cut = size
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.trim()) parts.push(rest)
  return parts.filter((part) => part.trim())
}

/** 章节内按整句切块，原句超过目标长度时保留全文。 */
export function chunkText(text, opts = {}) {
  const size = opts.chunkSize ?? RAG_DEFAULTS.chunkSize
  const overlap = opts.chunkOverlap ?? RAG_DEFAULTS.chunkOverlap
  const sections = text.split(/^#{1,6}\s+.*$/mu)
  const chunks = []
  for (const section of sections) {
    const sentences = section.split('\n').map((line) => line.trim())
      .filter((line) => line && !/^[-*_]{3,}$/u.test(line))
      .flatMap((line) => [...sentenceSegmenter.segment(line)].map(({ segment }) => segment.trim()))
      .flatMap((sentence) => splitLongSentence(sentence, size))
    let start = 0
    while (start < sentences.length) {
      let end = start + 1
      let length = sentences[start].length
      while (end < sentences.length && length + sentences[end].length + 1 <= size) {
        length += sentences[end++].length + 1
      }
      chunks.push(sentences.slice(start, end).join('\n'))
      if (end === sentences.length) break
      let next = end
      let shared = 0
      while (next > start + 1 && shared < overlap &&
          shared + sentences[next - 1].length + sentences[end].length + 1 <= size) {
        shared += sentences[--next].length + 1
      }
      start = next
    }
  }
  return chunks
}

export function listArticleFiles(root) {
  const files = []
  for (const volume of VOLUMES) {
    const dir = path.join(root, volume)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md')) continue
      files.push({ volume, name, full: path.join(dir, name) })
    }
  }
  return files.sort((a, b) => a.full.localeCompare(b.full, 'zh-CN'))
}

export function buildChunksFromRepo(root) {
  const articles = listArticleFiles(root)
  const chunks = []
  for (const { volume, name, full } of articles) {
    const raw = fs.readFileSync(full, 'utf8')
    const { body } = stripFrontmatter(raw)
    const meta = parseArticleFile(volume, name)
    const title = extractDisplayTitle(body, meta.shortTitle)
    const text = normalizeBodyForChunking(body)
    const parts = chunkText(text)
    parts.forEach((part, index) => {
      chunks.push({
        id: `${meta.slug}#${index}`,
        volume,
        title,
        path: meta.path,
        text: part,
      })
    })
  }
  return chunks
}

/** 按文章 path 去重，每篇最多保留 maxPerArticle 条（默认 1，避免参考列表重复） */
export function pickDiverseHits(scoredItems, topK, maxPerArticle = 1) {
  const counts = new Map()
  const picked = []
  for (const item of scoredItems) {
    const chunk = item.chunk ?? item
    const key = chunk.path || chunk.id
    const n = counts.get(key) ?? 0
    if (n >= maxPerArticle) continue
    counts.set(key, n + 1)
    picked.push(item)
    if (picked.length >= topK) break
  }
  return picked
}

export function toHitRecord(item) {
  const chunk = item.chunk ?? item
  return {
    id: chunk.id,
    volume: chunk.volume,
    title: chunk.title,
    path: chunk.path,
    text: chunk.text,
    score: Math.round((item.score ?? 0) * 1000) / 1000,
  }
}

export function dedupeHitsByPath(hits) {
  const seen = new Set()
  return hits.filter((h) => {
    const key = h.path || h.id || h.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const CN_STOPWORDS = new Set([
  '什么', '怎么', '如何', '为什么', '请问', '教员', '看待', '可以', '我们', '他们',
  '这个', '那个', '就是', '不是', '一个', '没有', '现在', '觉得',
  '感觉', '最近', '到底', '精髓', '问题', '事情', '东西', '自己', '真的', '还是',
  '以及', '因为', '所以', '如果', '但是', '已经', '可能', '应该', '需要', '关于',
])

/** 中文友好分词：书名、双字/三字片段，避免按空格切分失效 */
export function extractQueryTerms(query) {
  const q = (query || '').trim()
  if (!q) return []

  const terms = new Set()

  for (const t of q.match(/[a-zA-Z0-9]{2,}/gi) || []) {
    terms.add(t.toLowerCase())
  }

  const book = q.match(/《([^》]{2,24})》/)
  if (book) {
    const title = book[1].trim()
    terms.add(title)
    const t = title.replace(/[^\u4e00-\u9fa5]/g, '')
    for (let i = 0; i < t.length - 1; i++) {
      terms.add(t.slice(i, i + 2))
      if (i < t.length - 2) terms.add(t.slice(i, i + 3))
    }
  }

  const chinese = q.replace(/[^\u4e00-\u9fa5]/g, '')
  if (chinese.length >= 2 && chinese.length <= 10) {
    terms.add(chinese)
  }
  for (let i = 0; i < chinese.length - 1; i++) {
    terms.add(chinese.slice(i, i + 2))
    if (i < chinese.length - 2) terms.add(chinese.slice(i, i + 3))
  }

  for (const t of terms) {
    if (t.length < 2 || CN_STOPWORDS.has(t)) terms.delete(t)
  }

  return [...terms]
}

export function scoreChunkByTerms(chunk, terms) {
  if (!terms.length) return 0
  const title = chunk.title || ''
  const text = chunk.text || ''
  let matched = 0
  let weight = 0
  for (const t of terms) {
    if (title.includes(t)) {
      matched += 1
      weight += 4
    } else if (text.includes(t)) {
      matched += 1
      weight += 1
    }
  }
  if (matched === 0) return 0
  return weight / (terms.length * 4)
}

export function cosineSimilarity(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export function getEmbeddingConfig() {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.SILICONFLOW_API_KEY
  const baseUrl = (
    process.env.EMBEDDING_BASE_URL ||
    process.env.SILICONFLOW_BASE_URL ||
    'https://api.siliconflow.cn/v1'
  ).replace(/\/$/, '')
  const model =
    process.env.EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5'
  return { apiKey, baseUrl, model }
}

export async function embedTexts(texts, { apiKey, baseUrl, model, signal }) {
  if (!apiKey) {
    throw new Error(
      '缺少 EMBEDDING_API_KEY（或 SILICONFLOW_API_KEY）。请在 .env 中配置后运行 npm run rag:build'
    )
  }
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: 'float',
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || JSON.stringify(data))
  }
  const list = data.data || []
  list.sort((a, b) => a.index - b.index)
  return list.map((item) => item.embedding)
}

export function getRerankConfig() {
  const apiKey = process.env.RERANK_API_KEY ||
    process.env.EMBEDDING_API_KEY ||
    process.env.SILICONFLOW_API_KEY
  const baseUrl = (
    process.env.RERANK_BASE_URL ||
    process.env.EMBEDDING_BASE_URL ||
    process.env.SILICONFLOW_BASE_URL ||
    'https://api.siliconflow.cn/v1'
  ).replace(/\/$/, '')
  const model = process.env.RERANK_MODEL || 'BAAI/bge-reranker-v2-m3'
  return { apiKey, baseUrl, model }
}

/** 交叉编码器重排：只用来改顺序，不用分数做绝对阈值（各家返回值量纲不同） */
export async function rerankTexts(query, documents, { apiKey, baseUrl, model, signal }) {
  if (!apiKey) throw new Error('缺少 rerank 密钥')
  if (!documents.length) return []
  const response = await fetch(`${baseUrl}/rerank`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      query,
      documents,
      top_n: documents.length,
      return_documents: false,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || data.message || JSON.stringify(data))
  return (data.results || []).map(({ index, relevance_score: score }) => ({ index, score }))
}

export async function embedInBatches(texts, config, batchSize = 12) {  const all = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const vectors = await embedTexts(batch, { ...config, signal: AbortSignal.timeout(30_000) })
    const dimension = all[0]?.length || vectors[0]?.length
    if (vectors.length !== batch.length || !dimension ||
        vectors.some((vector) => vector?.length !== dimension || vector.some((value) => !Number.isFinite(value)))) {
      throw new Error(`Embedding 批次返回了无效向量（起始位置 ${i}）`)
    }
    all.push(...vectors)
    process.stdout.write(
      `\r  embedding ${Math.min(i + batch.length, texts.length)} / ${texts.length}`
    )
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  process.stdout.write('\n')
  return all
}
