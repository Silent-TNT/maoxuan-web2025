import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import {
  extractQueryTerms,
  pickDiverseHits,
  scoreChunkByTerms,
} from './lib.mjs'
import { shouldPreferReadingContext } from '../../api/chat-handler.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '../..')
const questions = JSON.parse(fs.readFileSync(path.join(scriptDir, 'eval-questions.json'), 'utf8'))
const index = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'api/rag-index.json.gz'))))

let passed = 0
const failures = []

for (const item of questions) {
  const terms = extractQueryTerms(item.question)
  const scored = index.chunks
    .map((chunk) => ({ chunk, score: scoreChunkByTerms(chunk, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  const hits = pickDiverseHits(scored, 5, 1).map((entry) => entry.chunk.title)
  const ok = hits.includes(item.expectedTitle)
  if (ok) passed++
  else failures.push({ question: item.question, expected: item.expectedTitle, hits })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${item.expectedTitle}  <-  ${item.question}`)
}

const rate = questions.length ? passed / questions.length : 0
console.log(`\n${passed}/${questions.length} passed (${Math.round(rate * 100)}%)`)

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
