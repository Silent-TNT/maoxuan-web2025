import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  listMarkdownFiles,
  markerNumber,
  markerPattern,
  normalizeRoute,
  parseArticle,
  validateGeneratedSelectors,
} from './lib.mjs'

const root = process.cwd()
const file = path.join(root, '.vitepress/data/note-selectors.generated.json')
const data = JSON.parse(await fs.readFile(file, 'utf8'))
const errors = validateGeneratedSelectors(data)
const articles = new Map()

for (const markdownFile of await listMarkdownFiles(root)) {
  const route = normalizeRoute(markdownFile, root)
  if (!data[route]) continue
  articles.set(route, parseArticle(await fs.readFile(markdownFile, 'utf8'), route))
}

for (const [route, notes] of Object.entries(data)) {
  const article = articles.get(route)
  if (!article) {
    errors.push(`${route}: 找不到对应 Markdown 或注释区`)
    continue
  }
  for (const [number, selectors] of Object.entries(notes)) {
    if (!article.notes.has(Number(number))) errors.push(`${route} 注${number}: 注释区不存在该编号`)
    for (const selector of selectors) {
      const source = `${selector.prefix || ''}${selector.exact}${selector.suffix || ''}`
      let sourceIndex = article.body.indexOf(source)
      if (sourceIndex < 0) {
        errors.push(`${route} 注${number}: 原文无法匹配 ${JSON.stringify(source)}`)
        continue
      }
      let belongsToNumber = false
      while (sourceIndex >= 0) {
        const exactEnd = sourceIndex + (selector.prefix || '').length + selector.exact.length
        const nextMarker = article.body.slice(exactEnd, exactEnd + 181).match(markerPattern)?.[0]
        if (nextMarker && markerNumber(nextMarker) === Number(number)) {
          belongsToNumber = true
          break
        }
        sourceIndex = article.body.indexOf(source, sourceIndex + 1)
      }
      if (!belongsToNumber) {
        errors.push(`${route} 注${number}: 目标后方最近角标并非该注号 ${JSON.stringify(selector.exact)}`)
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`校验通过：${Object.keys(data).length} 篇文章。`)
