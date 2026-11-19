import { normalizePath, toDocumentPath } from './reading-position.mjs'

const STORAGE_KEY = 'maoxuan-favorites-v1'
const VOLUME = /^\/(第一卷|第二卷|第三卷|第四卷)\/(\d+)-([^/]+)$/
const CONTEXT_LENGTH = 40
const NON_READING_TEXT = 'button, .margin-note-anchor, .margin-note-inline-group, .margin-note-source'

export function favoriteArticlePath(path) {
  try {
    const decoded = decodeURI(normalizePath(path))
    return VOLUME.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function readFavorites(storage) {
  try {
    const records = JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(records)) return []
    return records.filter((entry) =>
      entry && typeof entry.id === 'string' && /^[\w-]+$/.test(entry.id) &&
      typeof entry.path === 'string' &&
      favoriteArticlePath(entry.path) === entry.path &&
      typeof entry.title === 'string' &&
      (entry.kind === 'paragraph' || entry.kind === 'quote') &&
      typeof entry.text === 'string' && entry.text.length > 0 &&
      typeof entry.prefix === 'string' && typeof entry.suffix === 'string' &&
      Number.isSafeInteger(entry.start) && Number.isFinite(entry.createdAt),
    ).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export function saveFavorites(records, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

export function watchFavorites(refresh) {
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) refresh()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('pageshow', refresh)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pageshow', refresh)
  }
}

export function favoriteLink(favorite) {
  return toDocumentPath(favorite.path) + '#favorite-' + favorite.id
}

export function makeFavoriteAnchor(text, start, end) {
  const quote = text.slice(start, end)
  start += quote.length - quote.trimStart().length
  end -= quote.length - quote.trimEnd().length
  if (start >= end) return null
  return {
    start,
    text: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH),
  }
}

export function locateFavorite(anchor, text, paragraphs) {
  const candidates = []
  if (anchor.kind === 'paragraph') {
    for (const paragraph of paragraphs) {
      if (paragraph.text === anchor.text) candidates.push(paragraph.start)
    }
  } else {
    for (let index = text.indexOf(anchor.text); index >= 0; index = text.indexOf(anchor.text, index + 1)) {
      candidates.push(index)
    }
  }
  if (candidates.length === 1) return candidates[0]
  const matchingContext = candidates.filter((start) =>
    start >= anchor.prefix.length &&
    text.startsWith(anchor.prefix, start - anchor.prefix.length) &&
    text.startsWith(anchor.suffix, start + anchor.text.length)
  )
  if (matchingContext.length === 1) return matchingContext[0]
  return matchingContext.includes(anchor.start) ? anchor.start : null
}

export function readArticleText(root) {
  let text = ''
  const paragraphs = []
  const nodes = []

  for (const element of root.querySelectorAll('p')) {
    if (element.closest(NON_READING_TEXT)) continue
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT
        if (node.matches(NON_READING_TEXT)) return NodeFilter.FILTER_REJECT
        return node.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      },
    })
    let paragraphNodes = []
    let raw = ''

    function addParagraph() {
      const content = raw.trim()
      if (!content) return
      if (paragraphs.length > 0) text += '\n'
      const start = text.length
      const trimStart = raw.length - raw.trimStart().length
      const trimEnd = trimStart + content.length
      const firstNodeIndex = nodes.length
      for (const entry of paragraphNodes) {
        const from = Math.max(entry.start, trimStart)
        const to = Math.min(entry.end, trimEnd)
        if (from >= to) continue
        nodes.push({
          node: entry.node,
          offset: from - entry.start,
          start: start + from - trimStart,
          end: start + to - trimStart,
        })
      }
      text += content
      paragraphs.push({
        element, text: content, start, end: text.length,
        firstNode: nodes[firstNodeIndex],
        lastNode: nodes[nodes.length - 1],
      })
    }

    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node.nodeType === Node.TEXT_NODE) {
        paragraphNodes.push({ node, start: raw.length, end: raw.length + node.length })
        raw += node.data
      } else {
        // 部分文章在同一个 HTML 段落中用换行保留原书的分段。
        addParagraph()
        paragraphNodes = []
        raw = ''
      }
    }
    addParagraph()
  }
  return { text, paragraphs, nodes }
}

export function selectedArticleText(article, range) {
  let start
  let end
  for (const entry of article.nodes) {
    if (!range.intersectsNode(entry.node)) continue
    const from = range.startContainer === entry.node
      ? Math.max(0, range.startOffset - entry.offset)
      : 0
    const to = range.endContainer === entry.node
      ? Math.min(entry.end - entry.start, range.endOffset - entry.offset)
      : entry.end - entry.start
    if (from >= to) continue
    start ??= entry.start + from
    end = entry.start + to
  }
  return start === undefined ? null : makeFavoriteAnchor(article.text, start, end)
}

export function articleTextRange(article, start, length) {
  const end = start + length
  const first = article.nodes.find((entry) => entry.start <= start && entry.end > start)
  const last = article.nodes.find((entry) => entry.start < end && entry.end >= end)
  if (!first || !last) return null
  const range = document.createRange()
  range.setStart(first.node, first.offset + start - first.start)
  range.setEnd(last.node, last.offset + end - last.start)
  return range
}
