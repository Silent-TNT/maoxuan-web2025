import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import {
  listMarkdownFiles,
  normalizeRoute,
  parseArticle,
  selectorFromExact,
  validateGeneratedSelectors,
} from './lib.mjs'
import {
  buildReferenceIndex,
  compactResolution,
  resolveNoteReference,
} from './reference-resolver.mjs'

dotenv.config()

const root = process.cwd()
const outputFile = path.join(root, '.vitepress/data/note-selectors.generated.json')
const reviewFile = path.join(root, '.vitepress/data/note-selectors.review.json')
const args = process.argv.slice(2)
const articleArg = args.find((arg) => arg.startsWith('--article='))?.slice('--article='.length)
const limitArg = args.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length)
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')
const reviewReferences = args.includes('--review-references')
const hybridReferences = args.includes('--hybrid-references')
const referenceMode = reviewReferences || hybridReferences
const limit = limitArg ? Number(limitArg) : Number.POSITIVE_INFINITY

const apiKey = process.env.ANNOTATION_API_KEY
  || process.env.SILICONFLOW_API_KEY
  || process.env.EMBEDDING_API_KEY
const baseUrl = (process.env.ANNOTATION_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/$/, '')
const model = process.env.ANNOTATION_MODEL || 'deepseek-ai/DeepSeek-V3.2'
const minConfidence = Number(process.env.ANNOTATION_MIN_CONFIDENCE || 0.85)
const batchSize = Math.max(1, Number(process.env.ANNOTATION_BATCH_SIZE || 8))
const timeoutMs = Math.max(10_000, Number(process.env.ANNOTATION_TIMEOUT_MS || 60_000))
const concurrency = Math.max(1, Number(process.env.ANNOTATION_CONCURRENCY || 2))

if (!apiKey && !dryRun) {
  throw new Error('缺少 ANNOTATION_API_KEY、SILICONFLOW_API_KEY 或 EMBEDDING_API_KEY')
}

async function readJson(file, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function buildPrompt(occurrences) {
  const items = occurrences.map((occurrence) => ({
    id: occurrence.id,
    note: occurrence.number,
    marker: occurrence.marker,
    before_marker: occurrence.before,
    annotation: occurrence.note,
    ...(occurrence.referenceResolution ? {
      annotation_reference_chain: occurrence.referenceResolution.paths,
      resolved_annotations: occurrence.referenceResolution.finalAnnotations,
    } : {}),
  }))
  return `你是中文文献注释定位器。请根据注释含义，找出每个角标实际解释的正文范围。

规则：
1. targets 中每一项必须是 before_marker 中逐字、连续存在的原文，严禁改写或补字。
2. 只选择被注释解释的最小完整专名、术语、短语或引文，不要机械选择整句话。
3. “这在五卅运动”应选“五卅运动”；“蒋桂战争”不能只选“战争”。
4. 如果注释解释一段引文，可以选择完整引文；同一角标确实对应多个并列对象时可返回多个 target。
5. 正文中的（1）至（7）等章节枚举序号不是注释对象。
6. 如果 annotation 是“见某文注〔某号〕”一类交叉引用，必须根据 annotation_reference_chain 继续回溯，并以 resolved_annotations 判断正文对象，不能仅因当前层是交叉引用就返回空结果。
7. 如果当前层先给出实质解释、末尾才写“参见某文注〔某号〕”，resolved_annotations 会同时包含当前层解释和后续注释；当前层解释优先，后续引用只作补充，不得用无关的深层内容覆盖当前层含义。
8. 无法可靠判断时返回空 targets，并降低 confidence。

只返回 json，格式示例：
{"results":[{"id":"4-1","targets":["五卅运动"],"confidence":0.99,"reason":"注释解释历史事件专名"}]}

待处理数据：
${JSON.stringify(items)}`
}

async function callModel(occurrences) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: '你只输出合法 json，不输出 Markdown。' },
            { role: 'user', content: buildPrompt(occurrences) },
          ],
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      const payload = await response.json()
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('模型返回了空内容')
      return JSON.parse(content)
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
    }
  }
  throw lastError
}

async function callArticle(article, selectedOccurrences = article.occurrences) {
  const enrichedOccurrences = selectedOccurrences.map((occurrence) => {
    const resolution = compactResolution(
      resolveNoteReference(referenceIndex, article.route, occurrence.number)
    )
    return { ...occurrence, ...(resolution ? { referenceResolution: resolution } : {}) }
  })
  const results = []
  for (let start = 0; start < enrichedOccurrences.length; start += batchSize) {
    const batch = enrichedOccurrences.slice(start, start + batchSize)
    const response = await callModel(batch)
    if (Array.isArray(response?.results)) results.push(...response.results)
  }
  return { response: { results }, occurrences: enrichedOccurrences }
}

function evaluate(article, response, occurrences = article.occurrences) {
  const approved = {}
  const review = []
  const byId = new Map(occurrences.map((item) => [item.id, item]))
  const seen = new Set()

  for (const result of Array.isArray(response?.results) ? response.results : []) {
    const occurrence = byId.get(String(result.id))
    if (!occurrence) {
      review.push({ id: result.id, status: 'rejected', reason: '模型返回了未知 id' })
      continue
    }
    seen.add(occurrence.id)
    const confidence = Number(result.confidence || 0)
    const targets = Array.isArray(result.targets) ? result.targets : []
    const selectors = []
    const validationErrors = []
    for (const target of targets) {
      const checked = selectorFromExact(article, occurrence, target)
      if (checked.error) validationErrors.push({ target, error: checked.error })
      else selectors.push(checked.selector)
    }

    if (confidence >= minConfidence && selectors.length > 0 && validationErrors.length === 0) {
      approved[occurrence.number] ||= []
      for (const selector of selectors) {
        if (!approved[occurrence.number].some((item) => JSON.stringify(item) === JSON.stringify(selector))) {
          approved[occurrence.number].push(selector)
        }
      }
    } else {
      review.push({
        id: occurrence.id,
        note: occurrence.number,
        status: 'review',
        confidence,
        targets,
        modelReason: result.reason || '',
        validationErrors,
        annotation: occurrence.note,
        ...(occurrence.referenceResolution ? { referenceResolution: occurrence.referenceResolution } : {}),
        beforeMarker: occurrence.before,
      })
    }
  }

  for (const occurrence of occurrences) {
    if (!seen.has(occurrence.id)) {
      review.push({
        id: occurrence.id,
        note: occurrence.number,
        status: 'missing',
        reason: '模型未返回该角标',
        annotation: occurrence.note,
        ...(occurrence.referenceResolution ? { referenceResolution: occurrence.referenceResolution } : {}),
        beforeMarker: occurrence.before,
      })
    }
  }
  return { approved, review }
}

let generated = force && !articleArg && !referenceMode ? {} : await readJson(outputFile)
let reviews = force && !articleArg && !referenceMode ? {} : await readJson(reviewFile)
const allFiles = await listMarkdownFiles(root)
const articleByRoute = new Map()
for (const file of allFiles) {
  const route = normalizeRoute(file, root)
  const article = parseArticle(await fs.readFile(file, 'utf8'), route)
  if (article) articleByRoute.set(route, article)
}
const referenceIndex = buildReferenceIndex(articleByRoute)
let files = allFiles
if (articleArg) {
  const decoded = decodeURIComponent(articleArg).replace(/\\/g, '/').replace(/^\//, '').replace(/\.html$/, '')
  files = files.filter((file) => normalizeRoute(file, root).replace(/^\//, '') === decoded)
}
files = files.slice(0, limit)

if (dryRun) {
  let articles = 0
  let occurrences = 0
  for (const file of files) {
    const article = parseArticle(await fs.readFile(file, 'utf8'), normalizeRoute(file, root))
    if (!article?.occurrences.length) continue
    articles += 1
    occurrences += article.occurrences.length
  }
  console.log(`可处理文章 ${articles} 篇，注释角标 ${occurrences} 个；未调用 API。`)
  process.exit(0)
}

let processed = 0
const pending = []
if (referenceMode) {
  const selectedRoutes = new Set(files.map((file) => normalizeRoute(file, root)))
  for (const [route, article] of articleByRoute) {
    if (!selectedRoutes.has(route)) continue
    const occurrences = article.occurrences.filter((occurrence) => {
      const resolution = resolveNoteReference(referenceIndex, route, occurrence.number)
      return resolution.hasReferences && (!hybridReferences || resolution.finalAnnotations.length > 1)
    })
    const processedNumbers = new Set(occurrences.map((occurrence) => String(occurrence.number)))
    if (occurrences.length) pending.push({ route, article, occurrences, processedNumbers })
  }
} else {
  for (const file of files) {
    const route = normalizeRoute(file, root)
    if (!force && generated[route]) {
      console.log(`跳过已有结果：${route}`)
      continue
    }
    const article = articleByRoute.get(route)
    if (!article?.occurrences.length) continue
    pending.push({ route, article, occurrences: article.occurrences })
  }
}

for (let start = 0; start < pending.length; start += concurrency) {
  const group = pending.slice(start, start + concurrency)
  const results = await Promise.all(group.map(async ({ route, article, occurrences, processedNumbers }) => {
    console.log(`识别 ${route}（${occurrences.length} 个角标）`)
    try {
      const called = await callArticle(article, occurrences)
      return { route, processedNumbers, ...evaluate(article, called.response, called.occurrences) }
    } catch (error) {
      console.error(`失败 ${route}: ${error.message}`)
      return {
        route,
        processedNumbers,
        failed: true,
        approved: {},
        review: [],
      }
    }
  }))

  for (const { route, approved, review, processedNumbers, failed } of results) {
    if (failed && referenceMode) continue
    if (referenceMode) {
      generated[route] ||= {}
      for (const number of processedNumbers || []) delete generated[route][number]
      for (const [number, selectors] of Object.entries(approved)) {
        generated[route][number] = selectors
      }
      if (Object.keys(generated[route]).length === 0) delete generated[route]
      const untouched = (reviews[route] || []).filter((item) => (
        !processedNumbers?.has(String(item.note))
      ))
      reviews[route] = [...untouched, ...review]
      if (reviews[route].length === 0) delete reviews[route]
    } else {
      if (Object.keys(approved).length) generated[route] = approved
      else delete generated[route]
      if (review.length) reviews[route] = review
      else delete reviews[route]
    }
    processed += 1
  }
  try {
    await fs.writeFile(outputFile, `${JSON.stringify(generated, null, 2)}\n`)
    await fs.writeFile(reviewFile, `${JSON.stringify(reviews, null, 2)}\n`)
  } catch (error) {
    throw new Error(`写入生成结果失败：${error.message}`)
  }
}

const errors = validateGeneratedSelectors(generated)
if (errors.length) throw new Error(`生成文件校验失败：\n${errors.join('\n')}`)
console.log(`完成：处理 ${processed} 篇；通过 ${Object.keys(generated).length} 篇；待复核 ${Object.keys(reviews).length} 篇。`)
