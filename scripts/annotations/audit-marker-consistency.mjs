import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { listMarkdownFiles, markerNumber, markerPattern, normalizeRoute, parseArticle } from './lib.mjs'

const root = process.cwd()
const outputFile = path.join(root, 'scripts/annotations/marker-audit-report.md')
const files = await listMarkdownFiles(root)
const acceptedDuplicateReferences = new Set([
  // 注〔34〕说明相邻两段在同一次修订中补写，因此原文在两段末尾复用同一注号。
  '/第二卷/041-中国革命和中国共产党#34',
])

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const countText = (text, needle) => (text.match(new RegExp(escapeRegex(needle), 'g')) || []).length
const contextAt = (text, index, length = 90) => text
  .slice(Math.max(0, index - length), Math.min(text.length, index + length))
  .replace(/\s+/g, ' ')
  .trim()

const findings = []
const stats = {
  articles: 0,
  notes: 0,
  recognizedReferences: 0,
  lowParenthesizedSequences: 0,
  highParenthesizedReferences: 0,
  circledReferences: 0,
  missingReferences: 0,
  duplicateReferences: 0,
  acceptedDuplicateReferences: 0,
  orphanReferences: 0,
  alternateLowNumberCandidates: 0,
  squareBracketCandidates: 0,
  unsupportedCircledCandidates: 0,
}

for (const file of files) {
  const route = normalizeRoute(file, root)
  const markdown = await fs.readFile(file, 'utf8')
  const article = parseArticle(markdown, route)
  if (!article) continue
  stats.articles += 1
  stats.notes += article.notes.size
  stats.recognizedReferences += article.occurrences.length

  const recognizedCounts = new Map()
  for (const occurrence of article.occurrences) {
    recognizedCounts.set(occurrence.number, (recognizedCounts.get(occurrence.number) || 0) + 1)
    if (occurrence.number <= 20) stats.circledReferences += 1
    else stats.highParenthesizedReferences += 1
  }

  for (const number of article.notes.keys()) {
    const count = recognizedCounts.get(number) || 0
    if (count === 0) {
      stats.missingReferences += 1
      findings.push({ severity: '错误', route, number, issue: '底部有注释，但正文未找到受支持的对应角标' })
    } else if (count > 1) {
      if (acceptedDuplicateReferences.has(`${route}#${number}`)) {
        stats.acceptedDuplicateReferences += 1
      } else {
        stats.duplicateReferences += 1
        findings.push({ severity: '检查', route, number, issue: `正文出现 ${count} 次同编号脚注角标` })
      }
    }
  }

  const allSupportedMarkers = Array.from(article.body.matchAll(markerPattern))
  for (const match of allSupportedMarkers) {
    const number = markerNumber(match[0])
    if (!article.notes.has(number)) {
      stats.orphanReferences += 1
      findings.push({
        severity: '错误',
        route,
        number,
        issue: `正文角标 ${match[0]} 在底部没有对应注释`,
        context: contextAt(article.body, match.index || 0),
      })
    }
  }

  for (const match of article.body.matchAll(/[（(](\d{1,2})[）)]/g)) {
    const number = Number(match[1])
    if (number < 1 || number > 20) continue
    stats.lowParenthesizedSequences += 1
    if (article.notes.has(number) && !countText(article.body, String.fromCodePoint(0x2473 + number))) {
      stats.alternateLowNumberCandidates += 1
      findings.push({
        severity: '检查',
        route,
        number,
        issue: `${match[0]} 可能是采用括号写法的低编号脚注，也可能是正文序号`,
        context: contextAt(article.body, match.index || 0),
      })
    }
  }

  for (const match of article.body.matchAll(/〔(\d{1,3})〕/g)) {
    stats.squareBracketCandidates += 1
    findings.push({
      severity: '检查',
      route,
      number: Number(match[1]),
      issue: `正文出现方头括号编号 ${match[0]}，当前规则不会将其当作原始脚注角标`,
      context: contextAt(article.body, match.index || 0),
    })
  }

  for (const match of article.body.matchAll(/[㉑-㉟㊱-㊿]/g)) {
    stats.unsupportedCircledCandidates += 1
    findings.push({
      severity: '错误',
      route,
      number: 0,
      issue: `正文出现尚未支持的高位圆圈数字 ${match[0]}`,
      context: contextAt(article.body, match.index || 0),
    })
  }
}

const errorCount = findings.filter((item) => item.severity === '错误').length
const checkCount = findings.filter((item) => item.severity === '检查').length
const lines = [
  '# 全站正文序号与注释角标审计',
  '',
  `- 文章：${stats.articles} 篇`,
  `- 底部注释：${stats.notes} 条`,
  `- 正文有效角标：${stats.recognizedReferences} 个`,
  `- 其中⑴—⒇：${stats.circledReferences} 个`,
  `- 其中（21）以上：${stats.highParenthesizedReferences} 个`,
  `- 保留为正文序号的（1）—（20）：${stats.lowParenthesizedSequences} 个`,
  '',
  `结论：${errorCount === 0 ? '未发现确定性编号错误' : `发现 ${errorCount} 个确定性错误`}；${checkCount} 项需要语义检查。`,
  '',
  '## 异常统计',
  '',
  `- 底部有注释但正文缺少角标：${stats.missingReferences}`,
  `- 同编号角标重复出现：${stats.duplicateReferences}`,
  `- 已核实的合理重复引用：${stats.acceptedDuplicateReferences}`,
  `- 正文角标没有底部注释：${stats.orphanReferences}`,
  `- 可能采用（1）—（20）作为脚注的项目：${stats.alternateLowNumberCandidates}`,
  `- 正文出现〔1〕样式编号：${stats.squareBracketCandidates}`,
  `- 尚未支持的㉑—㊿样式：${stats.unsupportedCircledCandidates}`,
  '',
]

if (findings.length) {
  lines.push('## 逐项结果', '')
  for (const [index, item] of findings.entries()) {
    lines.push(`### ${index + 1}. [${item.severity}] ${item.route} 注〔${item.number || '？'}〕`, '')
    lines.push(`- 问题：${item.issue}`)
    if (item.context) lines.push(`- 上下文：${item.context}`)
    lines.push('')
  }
}

await fs.writeFile(outputFile, `${lines.join('\n')}\n`, 'utf8')
console.log(JSON.stringify({ ...stats, errorCount, checkCount }, null, 2))
console.log(`审计报告：${outputFile}`)
if (errorCount > 0) process.exitCode = 1
