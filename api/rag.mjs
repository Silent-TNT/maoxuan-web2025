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

function keywordRetrieve(index, query, topK, minScore) {
  const terms = extractQueryTerms(query)
  if (!terms.length) {
    return { hits: [], context: '' }
  }

  const scored = index.chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunkByTerms(chunk, terms),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const min = Math.max(minScore * 0.35, 0.12)
  const qualified = scored.filter((x) => x.score >= min)
  const picked = pickDiverseHits(qualified, topK, 1)
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
    return keywordRetrieve(index, query, topK, minScore)
  }

  const config = getEmbeddingConfig()
  if (!config.apiKey) {
    console.warn('[rag] 无 EMBEDDING_API_KEY，回退关键词检索')
    return keywordRetrieve(index, query, topK, minScore)
  }

  const [queryVec] = await embedTexts([query], config)
  const scored = index.chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryVec, chunk.embedding),
  }))
  scored.sort((a, b) => b.score - a.score)

  const qualified = scored.filter((x) => x.score >= minScore)
  let picked = pickDiverseHits(qualified, topK, 1)
  // 略低于阈值但最相关的一篇仍可保留，避免空引用
  if (picked.length === 0 && scored[0]?.score >= minScore * 0.85) {
    picked = pickDiverseHits(scored.slice(0, 8), Math.min(2, topK), 1)
  }
  const hits = picked.map(toHitRecord)
  return { hits, context: formatContext(hits) }
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
需要引用时，只使用上方摘录中已给出的 Markdown 链接格式，勿自造 URL。若摘录不足以回答，可坦诚说明并建议用户阅读对应篇章。`
}
