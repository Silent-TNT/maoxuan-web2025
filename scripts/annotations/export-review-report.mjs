import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { listMarkdownFiles, normalizeRoute, parseArticle } from './lib.mjs'

const root = process.cwd()
const reviewFile = path.join(root, '.vitepress/data/note-selectors.review.json')
const outputFile = path.join(root, 'scripts/annotations/annotation-review-checklist.md')
const volumeDirectory = path.join(root, 'scripts/annotations/review-checklists')
const reviewData = JSON.parse(await fs.readFile(reviewFile, 'utf8'))

const cleanText = (value = '') => String(value).replace(/\s+/g, ' ').trim()
const escapeInline = (value = '') => cleanText(value).replace(/`/g, '\\`')
const volumeNames = ['第一卷', '第二卷', '第三卷', '第四卷']
const volumeOrder = new Map(volumeNames.map((name, index) => [name, index + 1]))

const classify = (item) => {
  const targets = Array.isArray(item.targets) ? item.targets.filter(Boolean) : []
  const errors = Array.isArray(item.validationErrors) ? item.validationErrors : []
  if (targets.length === 0) return '模型未给出候选'
  if (errors.length > 0) return '候选未通过原文校验'
  return '候选存在但置信度不足'
}

const routeSort = (a, b) => {
  const aParts = a.replace(/^\//, '').split('/')
  const bParts = b.replace(/^\//, '').split('/')
  const volumeDifference = (volumeOrder.get(aParts[0]) || 99) - (volumeOrder.get(bParts[0]) || 99)
  if (volumeDifference) return volumeDifference
  return aParts.slice(1).join('/').localeCompare(bParts.slice(1).join('/'), 'zh-CN', { numeric: true })
}

const articleByRoute = new Map()
for (const file of await listMarkdownFiles(root)) {
  const route = normalizeRoute(file, root)
  const article = parseArticle(await fs.readFile(file, 'utf8'), route)
  if (article) articleByRoute.set(route, article)
}

const findOccurrence = (article, item) => {
  if (!article) return null
  return article.occurrences.find((occurrence) => (
    occurrence.number === Number(item.note)
    && occurrence.before === item.beforeMarker
  )) || null
}

const highlightTargets = (source, targets) => {
  let result = cleanText(source)
  let highlighted = 0
  const uniqueTargets = [...new Set(targets.map(cleanText).filter(Boolean))]
    .sort((a, b) => b.length - a.length)

  for (const target of uniqueTargets) {
    const index = result.lastIndexOf(target)
    if (index < 0) continue
    result = `${result.slice(0, index)}【${result.slice(index, index + target.length)}】${result.slice(index + target.length)}`
    highlighted += 1
  }
  return { text: result, highlighted }
}

const contextForItem = (article, item, targets) => {
  const occurrence = findOccurrence(article, item)
  if (!occurrence) {
    const highlighted = highlightTargets(item.beforeMarker || '', targets)
    return {
      before: highlighted.text || '未能定位正文上下文',
      after: '未能取得角标后的上下文',
      highlighted: highlighted.highlighted,
      found: false,
    }
  }

  const before = article.body.slice(Math.max(0, occurrence.markerIndex - 420), occurrence.markerIndex)
  const after = article.body.slice(
    occurrence.markerIndex + occurrence.marker.length,
    Math.min(article.body.length, occurrence.markerIndex + occurrence.marker.length + 220)
  )
  const highlighted = highlightTargets(before, targets)
  return {
    before: highlighted.text,
    after: cleanText(after),
    highlighted: highlighted.highlighted,
    found: true,
  }
}

const reviewFocus = (item) => {
  const targets = Array.isArray(item.targets) ? item.targets.filter(Boolean) : []
  const errors = Array.isArray(item.validationErrors) ? item.validationErrors : []
  if (targets.length === 0) {
    return '模型没有找到可靠对象。请判断原注释是在解释角标前最近的专名、术语、整句话，还是仅补充资料来源而无需划线。'
  }
  if (errors.some((error) => String(error.error || '').includes('距离'))) {
    return '候选离角标较远。重点判断注释是否确实回指较早内容；否则应选择角标前更近的词句。'
  }
  if (errors.some((error) => String(error.error || '').includes('连续原文'))) {
    return '模型候选不是正文中的连续原文。若语义方向正确，也必须改成正文里逐字连续的一段。'
  }
  if (errors.length > 0) {
    return '候选没有通过自动位置校验。请结合上下文判断语义方向，并重新确认精确起止边界。'
  }
  return '候选已经通过原文位置校验，只因模型置信度不足而留审。重点判断语义是否对应，以及范围是否过长或过短。'
}

const routes = Object.keys(reviewData).sort(routeSort)
const allItems = routes.flatMap((route) => reviewData[route].map((item) => ({ route, ...item })))
const typeCounts = allItems.reduce((counts, item) => {
  const type = classify(item)
  counts[type] = (counts[type] || 0) + 1
  return counts
}, {})

const volumeStats = volumeNames.map((volume) => {
  const volumeRoutes = routes.filter((route) => route.startsWith(`/${volume}/`))
  return {
    volume,
    routes: volumeRoutes,
    articles: volumeRoutes.length,
    items: volumeRoutes.reduce((total, route) => total + reviewData[route].length, 0),
  }
})

const sharedInstructions = [
  '每条记录按“正文语境 → 原注释 → 模型判断 → 复核结论”排列。正文中的 `【……】` 是模型候选，粗体 `〔注号〕` 是实际角标。',
  '',
  '- 候选准确：勾选“采用模型候选”。',
  '- 候选过长、过短或选错：勾选“修改为”，并复制正文中的连续原文。',
  '- 注释只是资料来源或整段补充、不应对应具体词句：勾选“无需划线”。',
]

const indexLines = [
  '# 注释语义定位复核入口',
  '',
  `生成日期：2026-08-28  `,
  `涉及文章：${routes.length} 篇  `,
  `待复核：${allItems.length} 条`,
  '',
  '## 使用方法',
  '',
  ...sharedInstructions,
  '',
  '## 分卷清单',
  '',
  '| 分卷 | 文章数 | 待复核 | 打开清单 |',
  '| --- | ---: | ---: | --- |',
  ...volumeStats.map(({ volume, articles, items }) => (
    `| ${volume} | ${articles} | ${items} | [打开${volume}复核清单](review-checklists/${volume}-复核清单.md) |`
  )),
  '',
  '## 分类统计',
  '',
  '| 类型 | 数量 |',
  '| --- | ---: |',
  `| 候选存在但置信度不足 | ${typeCounts['候选存在但置信度不足'] || 0} |`,
  `| 候选未通过原文校验 | ${typeCounts['候选未通过原文校验'] || 0} |`,
  `| 模型未给出候选 | ${typeCounts['模型未给出候选'] || 0} |`,
  `| **合计** | **${allItems.length}** |`,
  '',
]

await fs.mkdir(volumeDirectory, { recursive: true })
await fs.writeFile(outputFile, `${indexLines.join('\n')}\n`, 'utf8')

for (const { volume, routes: volumeRoutes, articles, items: itemCount } of volumeStats) {
  const lines = [
    `# ${volume}注释语义定位复核清单`,
    '',
    `[返回复核入口](../annotation-review-checklist.md)`,
    '',
    `涉及文章：${articles} 篇  `,
    `待复核：${itemCount} 条`,
    '',
    '## 阅读方法',
    '',
    ...sharedInstructions,
    '',
    '---',
    '',
  ]

  let sequence = 0
  for (const route of volumeRoutes) {
    const relativeMarkdown = `../../../${route.replace(/^\//, '')}.md`.replace(/\\/g, '/')
    const articleName = route.split('/').at(-1).replace(/^\d+-/, '')
    const items = reviewData[route]
    const article = articleByRoute.get(route)
    lines.push(`## ${articleName}（${items.length} 条）`, '')
    lines.push(`原文：[打开《${articleName}》Markdown](${relativeMarkdown})`, '')

    for (const item of items) {
      sequence += 1
      const targets = Array.isArray(item.targets) ? item.targets.filter(Boolean) : []
      const errors = Array.isArray(item.validationErrors) ? item.validationErrors : []
      const confidence = Number.isFinite(Number(item.confidence))
        ? `${Math.round(Number(item.confidence) * 100)}%`
        : '未提供'
      const context = contextForItem(article, item, targets)

      lines.push(`### ${sequence}. 注〔${item.note ?? '未知'}〕 · ${classify(item)}`, '')
      lines.push('#### ① 正文语境', '')
      lines.push(`> ……${context.before} **〔${item.note ?? '？'}〕** ${context.after}……`)
      if (targets.length && context.highlighted < targets.length) {
        lines.push('', `> ⚠ 有 ${targets.length - context.highlighted} 个候选未能在这段正文中逐字标出。`)
      }
      if (!context.found) lines.push('', '> ⚠ 未能按原角标位置完整还原上下文，请点击原文核对。')

      lines.push('', '#### ② 原注释', '')
      lines.push(`> ${cleanText(item.annotation) || '未记录'}`)

      lines.push('', '#### ③ 模型判断', '')
      lines.push(`- 模型候选：${targets.length ? targets.map((target) => `\`${escapeInline(target)}\``).join('；') : '**无**'}`)
      lines.push(`- 置信度：${confidence}`)
      if (item.modelReason) lines.push(`- 模型理由：${cleanText(item.modelReason)}`)
      if (errors.length) {
        lines.push('- 自动校验问题：')
        for (const error of errors) {
          lines.push(`  - ${error.target ? `\`${escapeInline(error.target)}\`：` : ''}${cleanText(error.error || error)}`)
        }
      }
      lines.push(`- **本条复核重点：${reviewFocus(item)}**`)

      lines.push('', '#### ④ 你的复核结论', '')
      if (targets.length) lines.push(`- [ ] 采用模型候选：${targets.map((target) => `\`${escapeInline(target)}\``).join('；')}`)
      lines.push('- [ ] 修改为其他范围')
      lines.push('  - 正确原文：')
      lines.push('- [ ] 无需划线')
      lines.push('- 复核备注：')
      lines.push('', '---', '')
    }
  }

  const volumeFile = path.join(volumeDirectory, `${volume}-复核清单.md`)
  await fs.writeFile(volumeFile, `${lines.join('\n')}\n`, 'utf8')
}

console.log(`已生成复核入口 ${outputFile}`)
console.log(`并按四卷拆分至 ${volumeDirectory}`)
console.log(`共 ${routes.length} 篇文章、${allItems.length} 条待复核记录。`)
