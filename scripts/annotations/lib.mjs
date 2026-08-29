import fs from 'node:fs/promises'
import path from 'node:path'

export const volumeNames = ['第一卷', '第二卷', '第三卷', '第四卷']
// 1—20 的真实注释角标使用 ⑴—⒇；（1）（2）等是正文枚举。
// Unicode 没有同组的 21 以上字符，原文从（21）开始改用括号数字。
export const markerPattern = /[⑴-⒇]|[（(](?:2[1-9]|[3-9]\d|[1-9]\d{2,})[）)]/g

export function markerNumber(marker) {
  const codePoint = marker.codePointAt(0) || 0
  if (codePoint >= 0x2474 && codePoint <= 0x2487) return codePoint - 0x2473
  const match = marker.match(/\d+/)
  return match ? Number(match[0]) : 0
}

export function normalizeRoute(file, root) {
  const relative = path.relative(root, file).replace(/\\/g, '/').replace(/\.md$/i, '')
  return `/${relative}`
}

export async function listMarkdownFiles(root) {
  const files = []
  for (const volume of volumeNames) {
    const directory = path.join(root, volume)
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.join(directory, entry.name))
    }
  }
  return files.sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '')
}

export function parseArticle(markdown, route) {
  const content = stripFrontmatter(markdown)
  const noteHeading = content.search(/^\s*-{5,}\s*\r?\n\s*注[　\s]*释\s*$/m)
  if (noteHeading < 0) return null

  const body = content.slice(0, noteHeading)
  const title = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() || route.split('/').at(-1)
  const noteBlock = content.slice(noteHeading)
  const notes = new Map()
  const noteRegex = /^\s*〔(\d+)〕\s*(.+?)\s*$/gm
  for (const match of noteBlock.matchAll(noteRegex)) {
    notes.set(Number(match[1]), match[2].replace(/\s{2,}$/g, '').trim())
  }
  if (notes.size === 0) return null

  const occurrences = []
  for (const match of body.matchAll(markerPattern)) {
    const number = markerNumber(match[0])
    const index = match.index ?? -1
    if (index < 0 || !notes.has(number)) continue
    const contextStart = Math.max(0, index - 420)
    const contextEnd = Math.min(body.length, index + match[0].length + 100)
    occurrences.push({
      id: `${number}-${occurrences.filter((item) => item.number === number).length + 1}`,
      number,
      marker: match[0],
      markerIndex: index,
      contextStart,
      context: body.slice(contextStart, contextEnd),
      before: body.slice(contextStart, index),
      note: notes.get(number),
    })
  }

  return { route, title, body, notes, occurrences }
}

export function selectorFromExact(article, occurrence, exact) {
  if (typeof exact !== 'string') return { error: '目标不是字符串' }
  const cleaned = exact.trim()
  if (cleaned.length === 0) return { error: '目标为空' }
  if (cleaned.length > 600) return { error: '目标过长' }

  const localMatches = []
  let cursor = occurrence.before.indexOf(cleaned)
  while (cursor >= 0) {
    localMatches.push(cursor)
    cursor = occurrence.before.indexOf(cleaned, cursor + 1)
  }
  if (localMatches.length === 0) return { error: '目标不是角标前上下文中的连续原文' }

  const localIndex = localMatches.at(-1)
  const endDistance = occurrence.before.length - (localIndex + cleaned.length)
  if (endDistance > 180) return { error: '目标距离角标超过180个字符' }
  if (
    cleaned.length === 1
    && !(
      endDistance === 0
      && /^\p{Script=Han}$/u.test(cleaned)
      && occurrence.note.trimStart().startsWith(cleaned)
    )
  ) return { error: '单字目标必须紧邻角标，且由注释开头直接释义' }

  const absoluteIndex = occurrence.contextStart + localIndex
  const prefix = article.body.slice(Math.max(0, absoluteIndex - 12), absoluteIndex)
  const suffix = article.body.slice(
    absoluteIndex + cleaned.length,
    Math.min(article.body.length, absoluteIndex + cleaned.length + 12)
  )
  return { selector: { exact: cleaned, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) } }
}

export function validateGeneratedSelectors(data) {
  const errors = []
  for (const [route, notes] of Object.entries(data)) {
    if (!route.startsWith('/')) errors.push(`${route}: 路由必须以 / 开头`)
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) {
      errors.push(`${route}: 文章数据必须是对象`)
      continue
    }
    for (const [number, selectors] of Object.entries(notes)) {
      if (!/^\d+$/.test(number) || !Array.isArray(selectors) || selectors.length === 0) {
        errors.push(`${route} 注${number}: selector 数组无效`)
        continue
      }
      for (const selector of selectors) {
        if (!selector || typeof selector.exact !== 'string' || selector.exact.length < 1) {
          errors.push(`${route} 注${number}: exact 无效`)
        }
      }
    }
  }
  return errors
}
