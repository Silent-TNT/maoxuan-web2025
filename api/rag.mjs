import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import {
  cosineSimilarity,
  embedTexts,
  extractQueryTerms,
  getEmbeddingConfig,
  pickDiverseHits,
  RAG_DEFAULTS,
  scoreChunkByTerms,
  toHitRecord,
} from '../scripts/rag/lib.mjs'

const apiDir = path.dirname(fileURLToPath(import.meta.url))
const INDEX_GZ = path.join(apiDir, 'rag-index.json.gz')
const INDEX_JSON = path.join(apiDir, 'rag-index.json')

let cachedIndex = null

function loadIndex() {
  if (cachedIndex) return cachedIndex
  if (fs.existsSync(INDEX_GZ)) {
    const buf = zlib.gunzipSync(fs.readFileSync(INDEX_GZ))
    cachedIndex = JSON.parse(buf.toString('utf8'))
    return cachedIndex
  }
  if (fs.existsSync(INDEX_JSON)) {
    cachedIndex = JSON.parse(fs.readFileSync(INDEX_JSON, 'utf8'))
    return cachedIndex
  }
  return null
}

export function isRagAvailable() {
  return loadIndex() != null && process.env.RAG_DISABLED !== '1'
}

/** 情绪倾诉类可跳过检索，省 token */
export function shouldSkipRetrieval(query) {
  const q = (query || '').trim()
  if (q.length < 4) return true
  const emotional = /难受|焦虑|迷茫|抑郁|失眠|想哭|累了|撑不住|没意思|孤独|崩溃|内耗|emo/i
  if (emotional.test(q) && q.length < 80) return true
  return false
}

function normalizeArticlePath(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(value.split('?')[0]).replace(/\/$/, '')
  } catch {
    return value.split('?')[0].replace(/\/$/, '')
  }
}

function articlePathMatches(chunkPath, preferredPath) {
  if (!preferredPath) return false
  const chunk = normalizeArticlePath(chunkPath).replace(/\.html$/, '')
  const preferred = normalizeArticlePath(preferredPath).replace(/\.html$/, '')
  return chunk === preferred
}

function keywordRetrieve(index, query, topK, minScore, options = {}) {
  const terms = extractQueryTerms(query)
  if (!terms.length) {
    return { hits: [], context: '' }
  }

  const scored = index.chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunkByTerms(chunk, terms) + (
        articlePathMatches(chunk.path, options.preferredPath)
          ? options.selectedText ? 0.45 : 0.12
          : 0
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const min = Math.max(minScore * 0.35, 0.12)
  const qualified = scored.filter((x) => x.score >= min)
  const picked = pickDiverseHits(qualified, topK, 2)
  const hits = picked.map(toHitRecord)

  // 无合格结果时不回退到「索引前 N 篇」，避免每次显示相同五篇
  return { hits, context: formatContext(hits) }
}

export async function retrieveContext(query, options = {}) {
  const index = loadIndex()
  if (!index) return { hits: [], context: '' }

  const topK = options.topK ?? RAG_DEFAULTS.topK
  const minScore = options.minScore ?? RAG_DEFAULTS.minScore

  if (index.mode === 'keyword' || !index.chunks[0]?.embedding) {
    return keywordRetrieve(index, query, topK, minScore, options)
  }

  const config = getEmbeddingConfig()
  if (!config.apiKey) {
    console.warn('[rag] 无 EMBEDDING_API_KEY，回退关键词检索')
    return keywordRetrieve(index, query, topK, minScore, options)
  }

  const [queryVec] = await embedTexts([query], config)
  const scored = index.chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryVec, chunk.embedding) + (
      articlePathMatches(chunk.path, options.preferredPath)
        ? options.selectedText ? 0.22 : 0.06
        : 0
    ),
  }))
  scored.sort((a, b) => b.score - a.score)

  const qualified = scored.filter((x) => x.score >= minScore)
  let picked = pickDiverseHits(qualified, topK, 2)
  // 略低于阈值但最相关的一篇仍可保留，避免空引用
  if (picked.length === 0 && scored[0]?.score >= minScore * 0.85) {
    picked = pickDiverseHits(scored.slice(0, 8), Math.min(2, topK), 2)
  }
  const hits = picked.map(toHitRecord)
  return { hits, context: formatContext(hits) }
}

export function pickEvidenceExcerpt(text, query, maxChars = 260) {
  const raw = (text || '').replace(/\s+/g, ' ').trim()
  if (!raw || raw.length <= maxChars) return raw
  const sentences = raw.split(/(?<=[。！？；])/u).map((s) => s.trim()).filter(Boolean)
  if (sentences.length <= 1) return `${raw.slice(0, maxChars)}…`

  const terms = extractQueryTerms(query).filter((term) => term.length >= 2)
  let bestIndex = 0
  let bestScore = -1
  sentences.forEach((sentence, index) => {
    const score = terms.reduce((sum, term) => sum + (sentence.includes(term) ? term.length : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  let excerpt = sentences[bestIndex]
  let left = bestIndex - 1
  let right = bestIndex + 1
  while (excerpt.length < maxChars && (left >= 0 || right < sentences.length)) {
    if (left >= 0 && `${sentences[left]}${excerpt}`.length <= maxChars) {
      excerpt = `${sentences[left]}${excerpt}`
      left--
    } else if (right < sentences.length && `${excerpt}${sentences[right]}`.length <= maxChars) {
      excerpt = `${excerpt}${sentences[right]}`
      right++
    } else {
      break
    }
  }
  return excerpt.length > maxChars ? `${excerpt.slice(0, maxChars)}…` : excerpt
}

function formatContext(hits) {
  if (!hits.length) return ''
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] 《${h.title}》（${h.volume}）\n${h.text}\n链接：[《${h.title}》（${h.volume}）](${h.path})`
    )
    .join('\n\n')
}

export function buildRagSystemAddon(context) {
  if (!context) return ''
  return `

【本次从《毛泽东选集》检索到的原著摘录（回答须优先依据以下内容，勿编造未出现的引文）】
${context}

【引用格式（严格执行）】
回答中凡是陈述原著观点或解释篇章内容，要在对应结论句末标注摘录编号，如 [1]、[2]，并至少保留一条真正支持结论的站内链接。编号必须与上方摘录一致。只使用上方摘录中已给出的 Markdown 链接格式，勿自造 URL。若摘录不足以回答，必须坦诚说明，不可用印象补足。`
}
