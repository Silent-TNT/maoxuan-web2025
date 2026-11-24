import fs from 'node:fs'
import { VOLUMES, normalizeBodyForChunking, stripFrontmatter } from '../scripts/rag/lib.mjs'

const sentenceSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'sentence' })
const articleCache = new Map()

function articleParagraphs(path) {
  const match = path.match(/^\/([^/]+)\/([^/]+)\.html$/u)
  if (!match || !VOLUMES.includes(match[1])) return []
  if (articleCache.has(path)) return articleCache.get(path)

  const [, volume, slug] = match
  const file = new URL(`../${volume}/${encodeURIComponent(slug)}.md`, import.meta.url)
  if (!fs.existsSync(file)) return []
  const { body } = stripFrontmatter(fs.readFileSync(file, 'utf8'))
  const paragraphs = normalizeBodyForChunking(body).split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(?:#{1,6}\s|[-*_]{3,}$)/u.test(line))
    .map((text) => ({
      text,
      sentences: [...sentenceSegmenter.segment(text)].map(({ segment, index }) => ({
        text: segment.trim(),
        start: index,
        end: index + segment.length,
      })),
    }))
  articleCache.set(path, paragraphs)
  return paragraphs
}

export function findQuoteCandidates(hit) {
  const paragraphs = articleParagraphs(hit.path)
  const candidates = new Map()
  for (const fragment of hit.text.split('\n')) {
    const needle = fragment.trim().replace(/…$/u, '')
    if (!needle) continue
    const paragraphIndex = paragraphs.findIndex(({ text }) => text.includes(needle))
    if (paragraphIndex < 0) continue

    const { text, sentences } = paragraphs[paragraphIndex]
    const start = text.indexOf(needle)
    const first = sentences.findIndex((sentence) => sentence.end > start)
    const last = sentences.findIndex((sentence) => sentence.end >= start + needle.length)
    if (first < 0 || last < first) continue

    // Expand the retrieved slice back to whole sentences, with one neighbor on either side.
    const from = Math.max(first - 1, 0)
    const to = Math.min(last + 1, sentences.length - 1)
    for (let i = from; i <= to; i++) {
      const sentence = sentences[i]
      if (!/[。！？.!?][”’」』）】)'"]*$/u.test(sentence.text)) continue
      const id = `${paragraphIndex}.${i}`
      const contextStart = sentences[i - 1]?.start ?? sentence.start
      const contextEnd = sentences[i + 1]?.end ?? sentence.end
      candidates.set(id, {
        id,
        text: sentence.text,
        contextText: contextEnd - contextStart <= 540 && contextEnd - contextStart > sentence.end - sentence.start
          ? text.slice(contextStart, contextEnd).trim()
          : '',
      })
    }
  }
  return [...candidates.values()]
}
