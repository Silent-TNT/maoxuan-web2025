import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { retrieveContext, isRagAvailable, shouldSkipRetrieval, buildRagSystemAddon } from '../api/rag.mjs'
import { finalizeChatReply } from '../api/chat-handler.mjs'

const out = path.resolve('notes/prompt-comparison-2026-10-23')
fs.mkdirSync(out, { recursive: true })
const readGit = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })
const extract = source => {
  const match = source.match(/const PERSONA_PROMPT = `([\s\S]*?)`/)
  if (!match) throw new Error('Cannot extract persona')
  return match[1]
}
const versions = [
  { id: 'A', label: '模仿教员版', ref: 'f6bb8aa^', persona: extract(readGit('f6bb8aa^', 'api/chat-handler.mjs')) },
  { id: 'B', label: '8月客观叙述版', ref: 'f6bb8aa', persona: extract(readGit('f6bb8aa', 'api/chat-handler.mjs')) },
  { id: 'C', label: '本次优化版', ref: 'working-tree', persona: extract(fs.readFileSync('api/chat-handler.mjs', 'utf8')) },
]
const previousRagSource = readGit('HEAD', 'api/rag.mjs')
const oldHeading = previousRagSource.match(/【本次从《毛泽东选集》检索到的原著摘录[^\n]+/)[0]
const questions = [
  { id: 'emotion', label: '情绪倾诉', question: '最近每天上班都很累，回家只想躺着，感觉自己很没用。我现在不想听建议，只想有人听我说说。' },
  { id: 'decision', label: '信息不足的辞职决策', question: '我工作很累，想辞职，又不敢。你觉得我该不该辞？' },
  { id: 'constraints', label: '已有明确条件的现实问题', question: '我有6个月生活费的存款，没有负债和赡养压力。现在每天加班到十点，但还没找到下家。我想换工作，不考虑转行。请帮我安排接下来两周的行动。' },
  { id: 'concept', label: '原著概念辨析', question: '主要矛盾和矛盾的主要方面有什么区别？请用同一个日常例子解释，并说明哪些是原文观点、哪些是你的类比。' },
  { id: 'false-quote', label: '错误引文核验', question: '毛泽东在《实践论》里说“只要足够努力，就一定能成功”，这句话该怎么理解？如果检索材料里没有这句话，请直接告诉我，不要替它编出处。' },
  { id: 'brief', label: '简短知识问答', question: '《实践论》主要讨论什么？请用三句话回答。' },
]
const model = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat'
if (!process.env.DEEPSEEK_API_KEY) throw new Error('Missing API key')
const manifest = { startedAt: new Date().toISOString(), model, temperature: 0.65, maxTokens: 2048, repetitions: 1, scope: 'Only persona and the revised RAG heading vary; current retrieval and citation postprocessing are shared. This is not a historical deployment replay.', versions, questions }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
const jobs = []
let keywordFallback = false
for (const item of questions) {
  let retrieval = { hits: [], context: '' }
  const skip = shouldSkipRetrieval(item.question)
  if (isRagAvailable() && !skip) {
    try { retrieval = await retrieveContext(item.question) }
    catch (error) {
      if (!/insufficient/i.test(error.message)) throw error
      keywordFallback = true
      delete process.env.EMBEDDING_API_KEY
      delete process.env.SILICONFLOW_API_KEY
      retrieval = await retrieveContext(item.question)
    }
  }
  const retrievalStatus = skip ? 'skipped' : retrieval.hits.length ? 'retrieved' : 'empty'
  fs.writeFileSync(path.join(out, `${item.id}-context.json`), JSON.stringify({ ...retrieval, retrievalStatus }, null, 2))
  const currentAddon = buildRagSystemAddon(retrieval.context)
  const previousAddon = currentAddon.replace(/【本次从《毛泽东选集》检索到的原著摘录[^\n]+/, oldHeading)
  for (const version of versions) jobs.push({ item, version, retrieval, retrievalStatus, system: version.persona + (version.id === 'C' ? currentAddon : previousAddon) })
}
let cursor = 0
const results = []
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]
    const start = Date.now()
    const record = { questionId: job.item.id, version: job.version.id, question: job.item.question, model, temperature: 0.65, systemHash: createHash('sha256').update(job.system).digest('hex'), retrievalStatus: job.retrievalStatus }
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: job.system }, { role: 'user', content: job.item.question }], temperature: 0.65, max_tokens: 2048 }),
        signal: AbortSignal.timeout(180000),
      })
      if (!response.ok) throw new Error(`API HTTP ${response.status}`)
      const data = await response.json()
      if (!data.choices?.[0]?.message?.content) throw new Error('Empty reply')
      Object.assign(record, { responseId: data.id, responseModel: data.model, usage: data.usage, finishReason: data.choices[0].finish_reason, rawReply: data.choices[0].message.content })
      record.displayReply = finalizeChatReply(record.rawReply, { ragHits: job.retrieval.hits, query: job.item.question, readingContext: null, retrievalStatus: job.retrievalStatus }).reply
      record.chars = record.rawReply.length
    } catch (error) { record.error = error.message }
    record.elapsedMs = Date.now() - start
    fs.writeFileSync(path.join(out, `${job.item.id}-${job.version.id}.json`), JSON.stringify(record, null, 2))
    results.push(record)
    console.log(`${record.questionId} ${record.version}: ${record.error || `${record.chars} chars, ${record.finishReason}, ${Math.round(record.elapsedMs / 1000)}s`}`)
  }
}
manifest.keywordFallback = keywordFallback
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
await Promise.all([worker(), worker(), worker()])
let markdown = '# 三版提示词真实模型回答对比\n\n'
markdown += `模型：${model}；temperature=0.65；每题每版一次；输出上限2048 tokens。测试题为构造样例，不是用户会话记录。\n\nA：8月8日修改前的人物扮演提示词；B：8月8日提交中的客观叙述提示词；C：本次工作区优化版。三版共享当前检索结果和引用后处理，仅切换人物提示词及本次修改的检索标题。不是历史模型或历史线上系统的完整重放。单次结果有随机性，不代表统计显著差异。\n\n每题列出模型原始回答；后处理后的显示文本另存对应 JSON 的 displayReply 字段。\n\n`
if (keywordFallback) markdown += '检索限制：向量服务账户余额不足，使用项目已有的关键词检索降级。所有版本共享同一份检索材料。\n\n'
for (const item of questions) {
  markdown += `## ${item.label}\n\n问题：${item.question}\n\n`
  for (const version of versions) {
    const r = results.find(x => x.questionId === item.id && x.version === version.id)
    markdown += `### ${version.id}：${version.label}\n\n${r.rawReply || r.error}\n\n字数（含Markdown字符）：${r.chars || 0}；耗时：${(r.elapsedMs / 1000).toFixed(1)}秒；结束原因：${r.finishReason || 'error'}。\n\n`
  }
}
fs.writeFileSync(path.join(out, '完整回答对比.md'), markdown)
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
console.log(`Saved ${results.length} results to ${out}`)
if (results.some(x => x.error || x.finishReason === 'length')) process.exitCode = 1
