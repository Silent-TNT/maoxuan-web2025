import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { handleChatStreamRequest, shouldPlanEvidence, shouldPreferReadingContext } from '../../api/chat-handler.mjs'
import { retrieveContext, shouldSkipRetrieval } from '../../api/rag.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.resolve(scriptDir, '../../.env') })
const questions = JSON.parse(fs.readFileSync(path.join(scriptDir, 'eval-questions.json'), 'utf8'))
const consultation = JSON.parse(fs.readFileSync(path.join(scriptDir, 'eval-consultation-questions.json'), 'utf8'))
const keywordOnly = process.argv.includes('--keyword-only')
const testChat = process.argv.includes('--chat')
// 对照实验：关掉 rerank 看纯融合的效果
if (process.argv.includes('--no-rerank')) process.env.RAG_RERANK_DISABLED = '1'
// 标定向量门槛：--floor=0.45
const floorArg = process.argv.find((arg) => arg.startsWith('--floor='))
if (floorArg) process.env.RAG_DENSE_FLOOR = floorArg.split('=')[1]
const windowArg = process.argv.find((arg) => arg.startsWith('--window='))
if (windowArg) process.env.RAG_DENSE_WINDOW = windowArg.split('=')[1]
const denseWeightArg = process.argv.find((arg) => arg.startsWith('--dense-weight='))
if (denseWeightArg) process.env.RAG_DENSE_WEIGHT = denseWeightArg.split('=')[1]
const rerankCandidatesArg = process.argv.find((arg) => arg.startsWith('--rerank-candidates='))
if (rerankCandidatesArg) process.env.RAG_RERANK_CANDIDATES = rerankCandidatesArg.split('=')[1]
if (process.argv.includes('--no-dense-dedupe')) process.env.RAG_DENSE_PATH_DEDUPE = '0'
const rerankDocArg = process.argv.find((arg) => arg.startsWith('--rerank-doc-chars='))
if (rerankDocArg) process.env.RAG_RERANK_DOC_CHARS = rerankDocArg.split('=')[1]
if (process.argv.includes('--no-quote-rerank')) process.env.RAG_QUOTE_RERANK = '0'
const topKArg = process.argv.find((arg) => arg.startsWith('--topk='))
if (topKArg) process.env.RAG_TOP_K = topKArg.split('=')[1]
const perHitArg = process.argv.find((arg) => arg.startsWith('--quotes-per-hit='))
if (perHitArg) process.env.RAG_QUOTES_PER_HIT = perHitArg.split('=')[1]
const recallPoolArg = process.argv.find((arg) => arg.startsWith('--recall-pool='))
if (recallPoolArg) process.env.RAG_RECALL_POOL = recallPoolArg.split('=')[1]
const neighborSpanArg = process.argv.find((arg) => arg.startsWith('--neighbor-span='))
if (neighborSpanArg) process.env.RAG_NEIGHBOR_SPAN = neighborSpanArg.split('=')[1]
const recallDenseArg = process.argv.find((arg) => arg.startsWith('--recall-dense='))
if (recallDenseArg) process.env.RAG_RECALL_DENSE = recallDenseArg.split('=')[1]
const caseLimit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]) || consultation.length
const caseOffset = Number(process.argv.find((arg) => arg.startsWith('--offset='))?.split('=')[1]) || 0
const cases = consultation.slice(caseOffset, caseOffset + caseLimit)
const modes = new Map()

const NETWORK_CODES = new Set([
  'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
])
function isTransient(error) {
  const code = error?.cause?.code || error?.code || ''
  return NETWORK_CODES.has(code) ||
    /socket disconnected|fetch failed|other side closed|network|timed? ?out|aborted/i.test(String(error?.message || ''))
}
async function withRetry(label, run, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (!isTransient(error) || attempt >= attempts) throw error
      console.warn(`[retry ${attempt}/${attempts - 1}] ${label}: ${error.cause?.code || error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
    }
  }
}
function recordMode(mode) {
  modes.set(mode, (modes.get(mode) || 0) + 1)
}
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}

let passed = 0
const failures = []
const reciprocalRanks = []

for (const item of questions) {
  const { hits, mode, denseTop } = await withRetry(item.question, () => retrieveContext(item.question, { keywordOnly }))
  recordMode(mode)
  const expectations = [item, ...(item.expectedRelated || [])]
  const covers = (hit, { expectedTitle, expectedQuote }) => hit.title === expectedTitle &&
    (!expectedQuote || hit.quotes.some((quote) => quote.text === expectedQuote))
  const missing = expectations.filter((expectation) => !hits.some((hit) => covers(hit, expectation)))
  const ok = missing.length === 0
  const rank = hits.findIndex((hit) => expectations.some((expectation) => covers(hit, expectation)))
  reciprocalRanks.push(rank >= 0 ? 1 / (rank + 1) : 0)
  if (ok) passed++
  else {
    failures.push({
      question: item.question,
      expected: missing.map(({ expectedTitle, expectedQuote }) => expectedQuote || expectedTitle).join(' / '),
      hits: hits.map((hit) => hit.title),
    })
    if (missing.some(({ expectedQuote }) => expectedQuote)) process.exitCode = 1
  }
  const titles = expectations.map(({ expectedTitle }) => expectedTitle).join(' + ')
  const topNote = Number.isFinite(denseTop) ? ` [denseTop ${denseTop}]` : ''
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${titles}${item.expectedQuote ? '（核对完整原句）' : ''}${topNote}  <-  ${item.question}`)
}

const rate = questions.length ? passed / questions.length : 0
const mrr = reciprocalRanks.length ? reciprocalRanks.reduce((sum, value) => sum + value, 0) / reciprocalRanks.length : 0
const top1 = reciprocalRanks.length ? reciprocalRanks.filter((value) => value === 1).length / reciprocalRanks.length : 0
console.log(`\n${passed}/${questions.length} passed (${Math.round(rate * 100)}%)  MRR@5 ${mrr.toFixed(3)}  top1 ${Math.round(top1 * 100)}%`)

if (failures.length) {
  console.log('\nFailures:')
  for (const failure of failures) {
    console.log(`- ${failure.question}`)
    console.log(`  expected: ${failure.expected}`)
    console.log(`  hits: ${failure.hits.join(' / ') || '(none)'}`)
  }
}

const routingCases = [
  {
    name: 'a claim that asks for counterevidence uses a search plan',
    actual: shouldPlanEvidence('《毛选》有没有能反驳我的说法？'),
    expected: true,
  },
  {
    name: 'a named passage or term lookup can retrieve directly',
    actual: shouldPlanEvidence('实事求是的定义出自《毛选》哪一篇？'),
    expected: false,
  },
  {
    name: 'explicit request for original text retrieves even with emotional wording',
    actual: shouldSkipRetrieval('很焦虑，《毛选》有讲这种情绪吗？'),
    expected: false,
  },
  {
    name: 'emotional check-in alone can skip retrieval',
    actual: shouldSkipRetrieval('我今天觉得很焦虑。'),
    expected: true,
  },
  {
    name: 'explicit cross-article question does not prefer current page',
    actual: shouldPreferReadingContext('主要矛盾和矛盾的主要方面有什么区别？', { title: '中国的红色政权为什么能够存在？' }),
    expected: false,
  },
  {
    name: 'deictic question prefers current page',
    actual: shouldPreferReadingContext('这段话为什么这样说？', { title: '实践论' }),
    expected: true,
  },
  {
    name: 'selected text always prefers current page',
    actual: shouldPreferReadingContext('请解释一下', { title: '实践论', selectedText: '感觉到了的东西' }),
    expected: true,
  },
]

for (const test of routingCases) {
  const ok = test.actual === test.expected
  console.log(`${ok ? 'PASS' : 'FAIL'}  routing: ${test.name}`)
  if (!ok) process.exitCode = 1
}

if (rate < 0.85) process.exitCode = 1

// 咨询题：检索层只看“有没有把该来的篇目带来”，判定口径与真实回答层分开
let checked = 0
let matched = 0
const consultationDenseTops = []
for (const item of cases) {
  const skips = shouldSkipRetrieval(item.question)
  const result = skips
    ? { hits: [], mode: 'skipped', denseTop: null }
    : await withRetry(item.question, () => retrieveContext(item.question, { keywordOnly }))
  recordMode(result.mode)
  if (Number.isFinite(result.denseTop)) consultationDenseTops.push(result.denseTop)
  const titles = [...new Set(result.hits.map(({ title }) => title))]
  const ok = item.expected ? item.expected.some((title) => titles.includes(title))
    : item.check === 'judgment' ? null : titles.length === 0
  if (ok !== null) {
    checked++
    if (ok) matched++
  }
  const review = ok === null ? 'REVIEW' : ok ? 'PASS' : 'MISS'
  const topNote = Number.isFinite(result.denseTop) ? ` [${result.mode} denseTop ${result.denseTop}]` : ` [${result.mode}]`
  console.log(`${review}  ${item.question} → ${titles.join(' / ') || '空'}${topNote}`)
  if (ok === false && !item.expected) process.exitCode = 1
}
console.log(`\n咨询检索 ${matched}/${checked}；待人工判断 ${cases.length - checked}；路径 ${JSON.stringify(Object.fromEntries(modes))}`)
if (consultationDenseTops.length) {
  console.log(`denseTop 中位 ${median(consultationDenseTops)}，范围 ${Math.min(...consultationDenseTops)}–${Math.max(...consultationDenseTops)}`)
}

// 「不含原著词汇」的生活题：词面几乎不重合，主要考语义检索与重排
const lifeQuestions = JSON.parse(fs.readFileSync(path.join(scriptDir, 'eval-life-questions.json'), 'utf8'))
let lifeTitle = 0
let lifeQuote = 0
let lifeTop1 = 0
let lifeRR = 0
for (const item of lifeQuestions) {
  const result = await withRetry(item.question, () => retrieveContext(item.question, { keywordOnly }))
  recordMode(result.mode)
  const rank = result.hits.findIndex((hit) => hit.title === item.expectedTitle)
  const quoteHit = result.hits.some((hit) => hit.title === item.expectedTitle &&
    hit.quotes.some((quote) => quote.text === item.expectedQuote))
  if (rank >= 0) lifeTitle++
  if (quoteHit) lifeQuote++
  if (rank === 0) lifeTop1++
  lifeRR += rank >= 0 ? 1 / (rank + 1) : 0
  const flag = quoteHit ? 'QUOTE' : rank >= 0 ? 'TITLE' : 'MISS '
  console.log(`LIFE ${flag} ${item.expectedTitle} [${result.mode}${result.rerank ? '+rerank' : ''}]  <-  ${item.question}`)
}
const lifeRate = lifeQuote / lifeQuestions.length
console.log(JSON.stringify({
  life: {
    total: lifeQuestions.length,
    titleRecall5: lifeTitle,
    quoteRecall5: lifeQuote,
    top1: lifeTop1,
    mrr: +(lifeRR / lifeQuestions.length).toFixed(3),
    rerank: process.env.RAG_RERANK_DISABLED === '1' ? 'off' : 'on',
    modePath: Object.fromEntries(modes),
  },
}))
if (lifeRate < 0.4) console.log('提示：生活题引文命中偏低，检索还没把对的段落带进来')

if (testChat) {
  if (keywordOnly) throw new Error('--chat 使用真实接口，不能与 --keyword-only 同时运行')
  const runs = []
  for (const item of cases) {
    const start = performance.now()
    let firstTextMs
    try {
      const result = await withRetry(item.question, () => handleChatStreamRequest(
        { messages: [{ role: 'user', content: item.question }] },
        (text) => { if (text.trim()) firstTextMs ??= Math.round(performance.now() - start) },
        AbortSignal.timeout(30_000),
      ))
      const citedTitles = [...new Set(result.sources.map(({ title }) => title))]
      // “有据”包括两种情况：真引了原文，或点明了自己用的是哪一条方法（调查研究/主要矛盾…）
      const methodMention = /调查研究|主要矛盾|矛盾的主要方面|内因|外因|具体问题具体分析|实践检验|实事求是|抓主要|没有调查/u.test(result.reply)
      const evidenced = result.sources.length > 0 || methodMention
      // 四类判定：引用了预期篇目 / 合理追问 / 该引没引 / 不该引却引了
      const status = item.expected
        ? citedTitles.some((title) => item.expected.includes(title)) ? 'CITED'
          : result.sources.length === 0 && result.awaitingReply ? 'ASKED' : 'MISS'
        : item.check === 'judgment' ? 'JUDGED'
          : result.sources.length === 0 ? 'CLEAN' : 'FALSE_CITE'
      const ok = status !== 'MISS' && status !== 'FALSE_CITE'
      const row = {
        question: item.question,
        status,
        ok,
        firstTextMs,
        citations: result.sources.length,
        citedTitles,
        methodMention,
        evidenced,
        mode: result.retrievalMode,
        denseTop: result.denseTop,
        rerank: result.rerank,
        answerChars: [...result.reply].length,
        guard: result.guard,
        reply: result.reply,
      }
      runs.push(row)
      console.log(JSON.stringify(row))
      if (!ok) process.exitCode = 1
    } catch (error) {
      console.error(`真实回答评测在第 ${runs.length + 1} 题中止：${error.cause?.code || error.message}`)
      process.exitCode = 1
      break
    }
  }
  if (runs.length) {
    const count = (status) => runs.filter(({ status: value }) => value === status).length
    console.log(JSON.stringify({
      completed: runs.length,
      cited: count('CITED'),
      asked: count('ASKED'),
      missed: count('MISS'),
      falseCite: count('FALSE_CITE'),
      clean: count('CLEAN'),
      judged: count('JUDGED'),
      methodMentionRuns: runs.filter(({ methodMention }) => methodMention).length,
      evidencedRuns: runs.filter(({ evidenced }) => evidenced).length,
      medianDenseTop: median(runs.map(({ denseTop }) => denseTop ?? NaN)),
      medianFirstTextMs: median(runs.map(({ firstTextMs }) => firstTextMs)),
      medianAnswerChars: median(runs.map(({ answerChars }) => answerChars)),
      guardedRuns: runs.filter(({ guard }) => guard).length,
      droppedChars: runs.reduce((sum, { guard }) => sum + (guard?.droppedChars || 0), 0),
    }))
  }
}
