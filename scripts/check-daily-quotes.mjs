import { readFile } from 'node:fs/promises'

// Ignore punctuation and whitespace so minor formatting changes cannot reintroduce a removed quote.
export const normalizeQuote = text => text.normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '')

export function findExcludedQuotes(quotes, excluded) {
  const excludedTexts = new Set(excluded.map(quote => normalizeQuote(quote.text)))
  return quotes.filter(quote => excludedTexts.has(normalizeQuote(quote.text)))
}

const source = await readFile(new URL('../.vitepress/data/quotes.js', import.meta.url), 'utf8')
const { quotes } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const excluded = JSON.parse(await readFile(new URL('../.vitepress/data/quotes-excluded.json', import.meta.url), 'utf8'))
const conflicts = findExcludedQuotes(quotes, excluded)

if (conflicts.length > 0) {
  console.error('每日一语包含已明确删除的句子。请核对 quotes-excluded.json：')
  for (const quote of conflicts) console.error('- ' + quote.text)
  process.exitCode = 1
} else {
  console.log('每日一语检查通过：' + quotes.length + ' 条在用，' + excluded.length + ' 条排除记录，无重新添加。')
}
