import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { listMarkdownFiles, markerNumber, normalizeRoute, parseArticle } from './lib.mjs'

const root = process.cwd()
const generatedFile = path.join(root, '.vitepress/data/note-selectors.generated.json')
const reviewFile = path.join(root, '.vitepress/data/note-selectors.review.json')
const generated = JSON.parse(await fs.readFile(generatedFile, 'utf8'))
const reviews = JSON.parse(await fs.readFile(reviewFile, 'utf8'))
const articles = new Map()

for (const file of await listMarkdownFiles(root)) {
  const route = normalizeRoute(file, root)
  const article = parseArticle(await fs.readFile(file, 'utf8'), route)
  if (article) articles.set(route, article)
}

const markerTextsForNumber = (number) => Number(number) <= 20
  ? [String.fromCodePoint(0x2473 + Number(number))]
  : [`（${number}）`, `(${number})`]

function selectorBelongsToRealMarker(article, number, selector) {
  const combined = `${selector.prefix || ''}${selector.exact}${selector.suffix || ''}`
  let combinedIndex = article.body.indexOf(combined)
  while (combinedIndex >= 0) {
    const exactStart = combinedIndex + (selector.prefix || '').length
    const exactEnd = exactStart + selector.exact.length
    const nearbyAfter = article.body.slice(exactEnd, exactEnd + 181)
    if (markerTextsForNumber(number).some((marker) => nearbyAfter.includes(marker))) return true
    combinedIndex = article.body.indexOf(combined, combinedIndex + 1)
  }
  return false
}

let removedSelectors = 0
let removedGeneratedNotes = 0
for (const [route, notes] of Object.entries(generated)) {
  const article = articles.get(route)
  if (!article) {
    delete generated[route]
    continue
  }
  for (const [number, selectors] of Object.entries(notes)) {
    const kept = selectors.filter((selector) => selectorBelongsToRealMarker(article, number, selector))
    removedSelectors += selectors.length - kept.length
    if (kept.length) notes[number] = kept
    else {
      delete notes[number]
      removedGeneratedNotes += 1
    }
  }
  if (Object.keys(notes).length === 0) delete generated[route]
}

function reviewBelongsToRealMarker(article, item) {
  if (!article || !item.beforeMarker || !item.note) return false
  let index = article.body.indexOf(item.beforeMarker)
  while (index >= 0) {
    const after = article.body.slice(index + item.beforeMarker.length)
    const marker = after.match(/^(?:[⑴-⒇]|[（(](?:2[1-9]|[3-9]\d|[1-9]\d{2,})[）)])/)?.[0]
    if (marker && markerNumber(marker) === Number(item.note)) return true
    index = article.body.indexOf(item.beforeMarker, index + 1)
  }
  return false
}

let removedReviews = 0
for (const [route, items] of Object.entries(reviews)) {
  const article = articles.get(route)
  const kept = items.filter((item) => reviewBelongsToRealMarker(article, item))
  removedReviews += items.length - kept.length
  if (kept.length) reviews[route] = kept
  else delete reviews[route]
}

await fs.writeFile(generatedFile, `${JSON.stringify(generated, null, 2)}\n`, 'utf8')
await fs.writeFile(reviewFile, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8')
console.log(`已移除枚举造成的 ${removedSelectors} 个选择器、${removedGeneratedNotes} 个注释结果、${removedReviews} 条复核记录。`)
