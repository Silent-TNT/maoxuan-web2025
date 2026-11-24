import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { findQuoteCandidates } from './rag-evidence.mjs'
import {
  buildChunksFromRepo,
  CHUNK_VERSION,
  cosineSimilarity,
  embedTexts,
  extractQueryTerms,
  getEmbeddingConfig,
  getRerankConfig,
  RAG_DEFAULTS,
  rerankTexts,
  scoreChunkByTerms,
  toHitRecord,
} from '../scripts/rag/lib.mjs'

const apiDir = path.dirname(fileURLToPath(import.meta.url))
const INDEX_GZ = path.join(apiDir, 'rag-index.json.gz')
const INDEX_JSON = path.join(apiDir, 'rag-index.json')

let cachedIndex = null
let lexicalIndex = null
const wordSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const queryFiller = /^(?:类似|道理|例子|事情|问题|情况|原文|文章|段落|毛选|有没有|哪些|谈到|说过|说法|能否|你会|一直|不能|怎么办|怎么做|到底|想知道|下次|现在|之后|目前|觉得|已经|一般|这个|这件|什么|可能|应该|是不是|解决|影响|进行|方法|工作|总是|还是)$/u
const indexRoot = fileURLToPath(new URL('../', import.meta.url))
/** 三个月、两周、八场这类数量词是处境细节，不是主题词，不能拿去匹配篇名或正文 */
const QUANTITY_WORD = /^(?:[\d一二三四五六七八九十两半几]+[个只场次周天月年块元]?[个只场次周天月年块元]?)$/u

/**
 * 向量召回的标定值。真实问题与正文块之间的 top1 余弦实测约 0.42–0.68，
 * 与“块和块”之间的相似度（中位 0.68）不是同一个分布，不能拿后者定查询阈值。
 * 两类问法的分布不同，分开标定：
 *  - 找篇名/原句：词法锚点强，只让向量补极少数，门槛也高
 *  - 生活问法（几乎不含原著词汇）：全靠语义，门槛放宽、窗口放宽
 */
const LOOKUP_INTENT = /《[^》]+》|原文|原话|原句|出处|出自|哪篇|毛选|毛泽东/u
const DENSE_RELATIVE_WINDOW = 0.015
const DENSE_FLOOR = 0.5
const DENSE_FLOOR_CORROBORATED = 0.46
const DENSE_WINDOW_LOOKUP = 0.005
const DENSE_FLOOR_LIFE = 0.42
/** 交叉编码器重排：候选池默认 20 条（实测 20 最优，28 反而引入噪声） */
const DEFAULT_RERANK_CANDIDATES = 20
const RERANK_TIMEOUT_MS = 1200
const QUOTE_RERANK_TIMEOUT_MS = 900

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
  if (/毛选|毛泽东选集|原文|出处|出自|《[^》]+》/u.test(q)) return false
  if (wantsListeningOnly(q)) return true
  const emotional = /难受|焦虑|迷茫|抑郁|失眠|想哭|累了|撑不住|没意思|孤独|崩溃|内耗|emo/i
  if (emotional.test(q) && q.length < 80) return true
  return false
}

export function wantsListeningOnly(query) {
  return /只(?:想|是|要)(?:有人|找人|让你)?(?:听我|说说|倾诉|吐槽|聊聊)|不(?:想|用|需要|要)(?:听|给我?)?(?:建议|分析|解决方案|讲道理)/u.test(query)
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

function loadLexicalIndex(index) {
  if (lexicalIndex) return lexicalIndex
  const fresh = index.version === CHUNK_VERSION ? index.chunks : buildChunksFromRepo(indexRoot)
  const chunks = fresh.length ? fresh : index.chunks
  const averageLength = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length
  lexicalIndex = { chunks, averageLength }
  return lexicalIndex
}

function lexicalCandidates(index, query, options, limit) {
  const { chunks, averageLength } = loadLexicalIndex(index)
  const terms = extractQueryTerms(query)
  const queryWords = [...wordSegmenter.segment(query)].filter((item) => item.isWordLike)
    .map((item) => item.segment).filter((word) => word.length >= 2 && !queryFiller.test(word) &&
      !QUANTITY_WORD.test(word))
  const wordSet = new Set(queryWords)
  const words = options.keywordCautious ? [...wordSet] : [...new Set([
    ...wordSet, ...terms.filter((term) => term.length >= 3 && !queryFiller.test(term) && !QUANTITY_WORD.test(term)),
  ])]
  const scored = new Map()
  for (const word of words) {
    const matches = chunks.filter((chunk) => chunk.text.includes(word) || chunk.title.includes(word))
    if (!matches.length || matches.length > chunks.length / 6) continue
    const idf = Math.log(1 + (chunks.length - matches.length + 0.5) / (matches.length + 0.5))
    for (const chunk of matches) {
      const item = scored.get(chunk) ?? { chunk, score: 0, matches: [] }
      const frequency = chunk.text.split(word).length - 1 + (chunk.title.includes(word) ? 2 : 0)
      const normalization = 1.2 * (0.25 + 0.75 * chunk.text.length / averageLength)
      item.score += idf * frequency * 2.2 / (frequency + normalization)
      item.matches.push(word)
      scored.set(chunk, item)
    }
  }

  const titles = new Set([...query.matchAll(/《([^》]+)》/gu)].map((match) => match[1]))
  for (const chunk of chunks) {
    const selected = options.selectedText?.trim()
    const isCurrent = articlePathMatches(chunk.path, options.preferredPath)
    const matchesSelection = isCurrent && selected && (
      chunk.text.replace(/\s+/gu, '').includes(selected.slice(0, 40).replace(/\s+/gu, '')) ||
      chunk.text.split('\n').some((sentence) => sentence.length >= 12 && selected.includes(sentence))
    )
    const named = titles.has(chunk.title) || chunk.title.length >= 5 && query.includes(chunk.title)
    const item = scored.get(chunk)
    if (named || matchesSelection) {
      scored.set(chunk, {
        chunk, matches: item?.matches || [],
        score: (item?.score || 0) + (matchesSelection ? 48 : 8),
        pinned: true,
      })
    } else if (item && isCurrent) {
      item.score *= 1.2
    }
  }
  const ranked = [...scored.values()].filter(({ chunk, matches, pinned }) =>
    pinned || matches.some((word) => matches.some((other) => !word.includes(other) && !other.includes(word))) ||
    (matches.length > 0 && terms.length <= 5 && scoreChunkByTerms(chunk, terms) >= 0.12))
    .sort((a, b) => b.score - a.score)
  const topScore = ranked[0]?.score
  return ranked.filter((item) => item.pinned || item.score >= Math.max(4, topScore * 0.35)).slice(0, limit)
}

export async function retrieveContext(query, options = {}) {
  const index = loadIndex()
  if (!index) return { hits: [], context: '', mode: 'unavailable', denseTop: null, rerank: false }

  const topK = options.topK ?? Number(process.env.RAG_TOP_K || RAG_DEFAULTS.topK)
  const limit = topK * 5
  const quoteToVerify = /原话|原句|哪篇|出处|出自|真的说过|这句吗/u.test(query)
    ? query.match(/[“「『]([^”」』\n]{6,})[”」』]/u)?.[1] : ''
  if (quoteToVerify) {
    const needle = quoteToVerify.replace(/[\s。！？]+$/u, '')
    const matches = loadLexicalIndex(index).chunks.filter((chunk) => chunk.text.includes(needle))
    return { ...(await prepareHits(matches.map((chunk) => ({ chunk, score: 1 })), topK, needle, { quoteRerank: false })), mode: 'exact-quote', denseTop: null, rerank: false }
  }
  const lexical = lexicalCandidates(index, query, options, limit)
  const denseResult = await denseCandidates(index, query, lexical, limit, options)
  const queries = options.preferredPath || options.selectedText || topK < 2
    ? []
    : [...new Set([
      ...suggestedSearches(query),
      ...(options.plannedQueries || []),
      ...(options.getPlannedQueries?.() || []),
    ])]
  const supplemental = queries.map((search) => lexicalCandidates(index, search, {}, 1))
  const denseWeight = Number(process.env.RAG_DENSE_WEIGHT || 1)
  // 同一篇只保留最好的一个块参与融合，避免一篇挤掉其他篇（默认开）
  const denseForFusion = process.env.RAG_DENSE_PATH_DEDUPE === '0'
    ? denseResult.ranked
    : dedupeByPath(denseResult.ranked)
  const fused = fuseRanks([
    { list: lexical, weight: 1 },
    { list: denseForFusion, weight: denseWeight },
    ...supplemental.map((list) => ({ list, weight: 1 })),
  ])
  // 明确在找某篇/某句时（篇名、原文、出处），词法锚点比语义重排可靠，不做重排
  const lookupIntent = LOOKUP_INTENT.test(query)
  let ranked = fused
  let chunkReranked = false
  let chunkAttempted = false
  if (!lookupIntent && options.rerank !== false) {
    // 两段式：先把“融合头部 + 邻居块 + 宽召回”拼成候选池，再整体重排
    const recallPool = buildRecallPool(index, fused, denseResult)
    const reranked = await rerankCandidates(recallPool, query, { ...options, rerank: true })
    const rerankedChunks = new Set(reranked.ranked.map(({ chunk }) => chunk))
    ranked = [...reranked.ranked, ...fused.filter(({ chunk }) => !rerankedChunks.has(chunk))]
    chunkReranked = reranked.applied
    chunkAttempted = reranked.attempted
  }
  // 引文级重排只在生活问法上用：按语义挑该引哪几句（篇目顺序仍由块级融合+重排决定）
  // 网络抖动导致块级重排刚超时过，就不再追加第二次重排，避免首字被拖长
  const quoteRerankMode = (!chunkAttempted || chunkReranked) && !lookupIntent &&
    options.rerank !== false && !options.keywordOnly && process.env.RAG_QUOTE_RERANK !== '0'
  const prepared = await prepareHits(ranked, topK, [query, ...queries].join(' '), {
    quoteRerank: quoteRerankMode,
    // 生活问法每篇只给一条依据，逼出跨篇多样性，避免整段回答引用同一篇
    maxPerArticle: lookupIntent ? 2 : Number(process.env.RAG_MAX_PER_ARTICLE_LIFE || 1),
    signal: options.signal,
    keywordOnly: options.keywordOnly,
  })
  return {
    ...prepared,
    // 只有 dense 真的贡献了候选才叫 hybrid，否则如实报 keyword / dense-empty
    mode: denseResult.ranked.length ? 'hybrid' : denseResult.mode,
    denseTop: denseResult.top,
    rerank: chunkReranked || prepared.quoteReranked,
  }
}

/** 按篇目去重，保留排序里每篇最好的一个块 */
function dedupeByPath(items) {
  const seen = new Set()
  return items.filter(({ chunk }) => {
    if (seen.has(chunk.path)) return false
    seen.add(chunk.path)
    return true
  })
}

let neighborMap = null

/** 同一篇里按块序号排好，用来取前后相邻块 */
function chunkNeighbors(index, chunk, span = 1) {
  if (!neighborMap) {
    neighborMap = new Map()
    for (const item of index.chunks) {
      const list = neighborMap.get(item.path) || []
      list.push(item)
      neighborMap.set(item.path, list)
    }
    for (const list of neighborMap.values()) {
      list.sort((a, b) => Number(String(a.id).split('#').pop()) - Number(String(b.id).split('#').pop()))
    }
  }
  const list = neighborMap.get(chunk.path) || []
  const at = list.findIndex((item) => item.id === chunk.id)
  if (at < 0) return []
  const out = []
  for (let offset = 1; offset <= span; offset++) {
    if (list[at - offset]) out.push(list[at - offset])
    if (list[at + offset]) out.push(list[at + offset])
  }
  return out
}

/**
 * 两段式召回的候选池：融合头部 + 相邻块扩展 + 向量宽召回（不受绝对门槛限制）。
 * 目的不是立刻给答案，而是先把“预期那句话所在的块”捞进可以被重排看到的范围。
 */
function buildRecallPool(index, fused, denseResult, options) {
  const poolLimit = Number(process.env.RAG_RECALL_POOL || 44)
  const neighborSpan = Number(process.env.RAG_NEIGHBOR_SPAN || 0)
  const denseRecall = Number(process.env.RAG_RECALL_DENSE || 24)
  const seen = new Set()
  const pool = []
  const push = (entry, source) => {
    const chunk = entry.chunk ?? entry
    const key = chunk.path + '\n' + chunk.text
    if (seen.has(key)) return
    seen.add(key)
    pool.push({ chunk, score: entry.score ?? 1, pinned: entry.pinned, source })
  }
  for (const item of fused.slice(0, 12)) push(item, 'fused')
  // 宽召回只收“可能相关”的块：低于绝对下限、且离 top1 太远的直接不要，避免把噪声塞进重排
  const recallFloor = Number(process.env.RAG_RECALL_FLOOR || 0.3)
  const top = denseResult.top ?? 0
  const plausible = (score) => top >= recallFloor && score >= Math.max(recallFloor, top - 0.25)
  for (const item of (denseResult.recall || []).slice(0, denseRecall)) {
    if (plausible(item.score ?? 0)) push(item, 'dense-recall')
  }
  // 邻居放在宽召回之后：先保证语义上最像的块进池，再用邻居补上下文
  if (neighborSpan > 0) {
    for (const item of fused.slice(0, 6)) {
      for (const neighbor of chunkNeighbors(index, item.chunk, neighborSpan)) push({ chunk: neighbor, score: 0.4 }, 'neighbor')
    }
  }
  return pool.slice(0, poolLimit)
}

/** 用交叉编码器把融合后的前若干条按语义相关度重排；失败或超时保持原顺序 */
async function rerankCandidates(fused, query, options) {
  if (process.env.RAG_RERANK_DISABLED === '1' || options.rerank === false || options.keywordOnly || fused.length < 3) {
    return { ranked: fused, applied: false, attempted: false }
  }
  const config = getRerankConfig()
  if (!config.apiKey) return { ranked: fused, applied: false, attempted: false }
  const candidateCount = Number(process.env.RAG_RERANK_CANDIDATES || DEFAULT_RERANK_CANDIDATES)
  const head = fused.slice(0, candidateCount)
  const tail = fused.slice(candidateCount)
  // 词法锚点命中的块（读者点名某篇、或选中原文）排在重排之前，保证它不会被语义重排挤掉
  const anchored = head.filter((item) => item.pinned)
  const rerankable = head.filter((item) => !item.pinned)
  const docChars = Number(process.env.RAG_RERANK_DOC_CHARS || 260)
  const documents = rerankable.map(({ chunk }) => `${chunk.title}\n${chunk.text}`.slice(0, docChars))
  try {
    const timeout = AbortSignal.timeout(RERANK_TIMEOUT_MS)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    const results = await rerankTexts(query, documents, { ...config, signal })
    if (!results.length) return { ranked: fused, applied: false, attempted: true }
    const scoreByIndex = new Map(results.map(({ index, score }) => [index, score]))
    const reordered = rerankable
      .map((item, index) => ({ item, score: scoreByIndex.get(index) ?? -Infinity }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
    return { ranked: [...anchored, ...reordered, ...tail], applied: true, attempted: true }
  } catch (error) {
    options.signal?.throwIfAborted()
    console.warn('[rag] rerank 失败，保持融合顺序:', error.cause?.code || error.message)
    return { ranked: fused, applied: false, attempted: true }
  }
}

/** 供评测与调参使用：分别返回词法、向量两路排序，不做融合 */
export async function retrieveRankings(query, options = {}) {
  const index = loadIndex()
  if (!index) return { lexical: [], dense: [], mode: 'unavailable', denseTop: null }
  const limit = (options.topK ?? RAG_DEFAULTS.topK) * 5
  const lexical = lexicalCandidates(index, query, options, limit)
  const denseResult = await denseCandidates(index, query, lexical, limit, options)
  return { lexical, dense: denseResult.ranked, mode: denseResult.mode, denseTop: denseResult.top }
}

function fuseRanks(rankings) {  const fused = new Map()
  for (const { list, weight = 1 } of rankings) {
    list.forEach(({ chunk, pinned }, rank) => {
      // Legacy and current windows can have overlapping ordinal IDs.
      const key = chunk.path + '\n' + chunk.text
      const item = fused.get(key) ?? { chunk, score: 0, pinned }
      item.score += weight / (20 + rank + 1)
      item.pinned ||= pinned
      fused.set(key, item)
    })
  }
  return [...fused.values()].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.score - a.score)
}

function suggestedSearches(query) {
  const searches = []
  const comparesWithOthers = /(?:跟|和|与|同|拿).{0,4}(?:别人|他人|外部|外界|外人|其他人).{0,6}(?:比|比较)|(?:外界|外部|别人|他人)(?:的)?(?:评价|排名|比较|进度)|(?:比起|盯着|看着)(?:别人|他人)/u.test(query)
  const looksInward = /(?:跟|和|与|同|拿).{0,4}(?:自己|以前的我|过去的我).{0,6}(?:比|比较)|纵向比较|自己能(?:改|控制)|从(?:自己|自身)(?:身上|出发|找)|着眼(?:自己|自身)|(?:判|看|衡量)自己/u.test(query)
  if (comparesWithOthers && looksInward) {
    if (/(?:骄傲|灰心|丧气|得意).{0,30}(?:骄傲|灰心|丧气|得意)/u.test(query)) {
      searches.push('《学习和时局》工作无成绩 悲观丧气 工作有成绩 趾高气扬')
    }
    searches.push('外因是变化的条件 内因是变化的根据 外因通过内因而起作用',
      '实事求是 从实际情况出发 引出规律性 客观存在')
  } else if (/(?:环境|外部|旺季|运气)/u.test(query) && /(?:自己|做法|能力|分别|解决问题)/u.test(query)) {
    searches.push('《矛盾论》外因是变化的条件 内因是变化的根据 外因通过内因而起作用')
  }
  if (/(?:照搬|套用|照抄)/u.test(query) && /(?:不同|换|变化|条件)/u.test(query) ||
      /(?:没搞清|没有搞清|没有弄清|不知道实际|汇报)/u.test(query) && /(?:表态|先去问|怎么查|调查)/u.test(query)) {
    searches.push('《反对本本主义》调查现实情况历史情况 没有调查没有发言权')
  }
  if (/(?:试验|实验|验证|检验|怎么试)/u.test(query) && /(?:结果|判断|有效|有用|预想)/u.test(query)) {
    searches.push('《实践论》把理性的认识再回到社会实践中去 应用理论于实践 预想的目的')
  }
  return searches
}

async function denseCandidates(index, query, lexical, limit, options) {
  if (options.keywordOnly || index.mode === 'keyword' || !index.chunks[0]?.embedding) {
    return { ranked: [], recall: [], mode: 'keyword', top: null }
  }

  const config = getEmbeddingConfig()
  if (!config.apiKey) return { ranked: [], recall: [], mode: 'keyword-fallback', top: null }

  let queryVec
  try {
    // 首字优先：向量服务慢或冷启动时直接走关键词，不让用户等
    const timeout = AbortSignal.timeout(1000)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    // 索引构建时文档侧只编码「标题 + 正文」，查询侧同样不加指令前缀，保持对称。
    const [vector] = await embedTexts([options.denseQuery || query], { ...config, signal })
    queryVec = vector
    if (queryVec?.length !== index.chunks[0].embedding.length) {
      throw new Error('查询向量维度与索引不一致')
    }
  } catch (error) {
    options.signal?.throwIfAborted()
    console.warn('[rag] 向量检索失败，尝试关键词检索:', error.cause?.code || error.message)
    return { ranked: [], recall: [], mode: 'keyword-fallback', top: null }
  }
  const corroboratedPaths = new Set(lexical.slice(0, 5).map(({ chunk }) => chunk.path))
  const scored = index.chunks.filter((chunk) => chunk.embedding).map((chunk) => ({
    chunk, score: cosineSimilarity(queryVec, chunk.embedding),
  })).sort((a, b) => b.score - a.score)
  const highest = scored[0]?.score ?? 0
  // 门槛可用环境变量覆盖，便于用真实题集标定（默认值来自真实题集实测分布）
  const lookupQuery = LOOKUP_INTENT.test(query)
  const floor = Number(process.env.RAG_DENSE_FLOOR ?? (lookupQuery ? DENSE_FLOOR : DENSE_FLOOR_LIFE))
  const corroboratedFloor = Number(process.env.RAG_DENSE_FLOOR_CORROBORATED ?? Math.max(0, floor - 0.04))
  const window = Number(process.env.RAG_DENSE_WINDOW ?? (lookupQuery ? DENSE_WINDOW_LOOKUP : DENSE_RELATIVE_WINDOW))
  const ranked = scored.filter(({ chunk, score }) =>
    score >= highest - window &&
    score >= (corroboratedPaths.has(chunk.path) ? corroboratedFloor : floor),
  ).slice(0, limit)
  // 宽召回：不设门槛的前若干块，只给两段式召回的候选池用
  const recall = scored.slice(0, Math.max(80, limit))
  return { ranked, recall, mode: ranked.length ? 'hybrid' : 'dense-empty', top: +highest.toFixed(3) }
}

/** 引文级重排：让重排模型直接判断“这句话能不能回答读者的问题”，而不是按词面挑句 */
const QUOTE_RERANK_MAX = 24

async function rerankQuoteCandidates(query, candidates, options) {
  if (process.env.RAG_RERANK_DISABLED === '1' || process.env.RAG_QUOTE_RERANK === '0' ||
      options.quoteRerank === false || options.keywordOnly) {
    return null
  }
  const config = getRerankConfig()
  if (!config.apiKey) return null
  const hitsLimit = Number(process.env.RAG_QUOTE_RERANK_HITS || 4)
  const documents = []
  const keys = []
  for (const { hit, quotes } of candidates.slice(0, hitsLimit)) {
    for (const quote of quotes.slice(0, 6)) {
      if (documents.length >= QUOTE_RERANK_MAX) break
      documents.push(`${hit.title}｜${quote.text}`.slice(0, 160))
      keys.push(`${hit.path}:${quote.id}`)
    }
    if (documents.length >= QUOTE_RERANK_MAX) break
  }
  if (documents.length < 2) return null
  try {
    const timeout = AbortSignal.timeout(QUOTE_RERANK_TIMEOUT_MS)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    const results = await rerankTexts(query.slice(0, 300), documents, { ...config, signal })
    const scores = new Map()
    for (const { index, score } of results) scores.set(keys[index], score)
    return scores
  } catch (error) {
    options.signal?.throwIfAborted()
    console.warn('[rag] 引文重排失败，退回词面打分:', error.cause?.code || error.message)
    return null
  }
}

async function prepareHits(scored, topK, query, options = {}) {
  const terms = extractQueryTerms(query)
  const candidates = []
  const poolCounts = new Map()
  const poolLimit = Math.max(topK * 6, 24)
  for (const item of scored) {
    if (candidates.length >= poolLimit) break
    const count = poolCounts.get(item.chunk.path) || 0
    if (count >= 2) continue
    const hit = toHitRecord(item)
    const quotes = findQuoteCandidates(hit)
    if (!quotes.length) continue
    candidates.push({ hit, quotes })
    poolCounts.set(hit.path, count + 1)
  }
  const quoteScores = await rerankQuoteCandidates(query, candidates, options)
  const perHit = Number(process.env.RAG_QUOTES_PER_HIT || 3)
  const maxPerArticle = Number(options.maxPerArticle ?? 2)
  const hits = []
  const counts = new Map()
  const used = new Set()
  for (const { hit, quotes } of candidates) {
    if (hits.length >= topK) break
    const count = counts.get(hit.path) || 0
    if (count >= maxPerArticle) continue
    const rankedQuotes = quotes
      .filter((quote) => !used.has(hit.path + ':' + quote.id))
      .map((quote) => ({
        quote,
        relevance: quoteScores?.get(`${hit.path}:${quote.id}`) ?? scoreChunkByTerms({ text: quote.text }, terms),
      }))
      .sort((a, b) => b.relevance - a.relevance)
    // 先按段落去重：避免把同一段话拆成三句、当成三条独立依据
    const picked = []
    const paragraphs = new Set()
    for (const item of rankedQuotes) {
      const paragraph = String(item.quote.id).split('.')[0]
      if (paragraphs.has(paragraph)) continue
      paragraphs.add(paragraph)
      picked.push(item.quote)
      if (picked.length >= perHit) break
    }
    if (picked.length < perHit) {
      for (const item of rankedQuotes) {
        if (picked.length >= perHit) break
        if (picked.includes(item.quote)) continue
        picked.push(item.quote)
      }
    }
    if (!picked.length) continue
    hits.push({ ...hit, quotes: picked })
    picked.forEach((quote) => used.add(hit.path + ':' + quote.id))
    counts.set(hit.path, count + 1)
  }
  return { hits, context: formatContext(hits), quoteReranked: Boolean(quoteScores) }
}

function formatContext(hits) {
  if (!hits.length) return ''
  return hits
    .map(
      (hit, i) => [
        `《${hit.title}》（${hit.volume}）`,
        ...hit.quotes.map((quote, j) => `[${i + 1}.${j + 1}] ${quote.text}`),
      ].join('\n')
    )
    .join('\n\n')
}

export function buildRagSystemAddon(context) {
  if (!context) return ''
  return `

【本次从《毛泽东选集》检索到的原著摘录，仅供核对观点和引用】
${context}

【引用格式（严格执行）】
在关键原著判断后附上最有力的原句编号，如 [2.3]。相邻原句讲同一个意思时，合在一起讲。完整复制上方给出的编号。正文可写篇名，网站会生成出处链接和证据卡片。摘录里只要有一句能直接支撑你正在讲的判断，就引它，别整段不引；一句都不贴切时宁可不引，改用日常话讲，或点一次方法名。直接谈读者的问题。`
}
