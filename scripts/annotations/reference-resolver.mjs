const volumeByNumeral = {
  一: '第一卷',
  二: '第二卷',
  三: '第三卷',
  四: '第四卷',
}

const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim()
const normalizeTitle = (value = '') => clean(value)
  .replace(/[⑴-⒇]|[（(]\d+[）)]/g, '')
  .replace(/[^\p{L}\p{N}]/gu, '')

const volumeFromRoute = (route = '') => route.replace(/^\//, '').split('/')[0] || ''

function substantivePrefix(annotation) {
  const text = clean(annotation)
  const referenceIndex = text.search(/(?:参见|见)(?:本卷|本书第[一二三四]卷)《/)
  if (referenceIndex < 0) return text
  return text.slice(0, referenceIndex).replace(/[，,；;。\s]+$/g, '').trim()
}

export function buildReferenceIndex(articleByRoute) {
  const byVolumeAndTitle = new Map()
  for (const article of articleByRoute.values()) {
    if (!article?.title) continue
    byVolumeAndTitle.set(
      `${volumeFromRoute(article.route)}\0${normalizeTitle(article.title)}`,
      article
    )
  }
  return { articleByRoute, byVolumeAndTitle }
}

export function extractNoteReferences(annotation, currentRoute) {
  const text = clean(annotation)
  const currentVolume = volumeFromRoute(currentRoute)
  const references = []
  const pattern = /(本卷|本书第([一二三四])卷)《([^》]+)》注〔(\d+)〕/g

  for (const match of text.matchAll(pattern)) {
    const volume = match[1] === '本卷' ? currentVolume : volumeByNumeral[match[2]]
    const title = clean(match[3])
    references.push({ volume, title, number: Number(match[4]), source: match[0] })

    const sentenceTail = text.slice((match.index || 0) + match[0].length).split('。')[0]
    for (const continuation of sentenceTail.matchAll(/[、和及]\s*注〔(\d+)〕/g)) {
      references.push({
        volume,
        title,
        number: Number(continuation[1]),
        source: continuation[0].replace(/^[、和及]\s*/, ''),
      })
    }
  }

  return references.filter((reference, index) => (
    references.findIndex((item) => (
      item.volume === reference.volume
      && normalizeTitle(item.title) === normalizeTitle(reference.title)
      && item.number === reference.number
    )) === index
  ))
}

export function resolveNoteReference(index, startRoute, startNumber, maxDepth = 8) {
  const visit = (route, number, depth, seen) => {
    const key = `${route}#${number}`
    const article = index.articleByRoute.get(route)
    if (!article) return { route, number, status: 'missing-article', annotation: '' }
    const annotation = article.notes.get(Number(number)) || ''
    const node = { route, title: article.title, number: Number(number), annotation, status: 'resolved' }
    if (!annotation) return { ...node, status: 'missing-note' }
    if (seen.has(key)) return { ...node, status: 'cycle' }
    if (depth >= maxDepth) return { ...node, status: 'depth-limit' }

    const references = extractNoteReferences(annotation, route)
    if (references.length === 0) return node

    const nextSeen = new Set(seen).add(key)
    node.children = references.map((reference) => {
      const target = index.byVolumeAndTitle.get(
        `${reference.volume}\0${normalizeTitle(reference.title)}`
      )
      if (!target) {
        return {
          route: '',
          title: reference.title,
          number: reference.number,
          annotation: '',
          status: 'missing-article',
        }
      }
      return visit(target.route, reference.number, depth + 1, nextSeen)
    })
    return node
  }

  const root = visit(startRoute, Number(startNumber), 0, new Set())
  const finalAnnotations = []
  const unresolved = []
  const paths = []

  const walk = (node, path = []) => {
    const step = {
      route: node.route,
      title: node.title,
      number: node.number,
      annotation: node.annotation,
      status: node.status,
    }
    const nextPath = [...path, step]
    if (Array.isArray(node.children) && node.children.length > 0) {
      const currentSubstance = substantivePrefix(node.annotation)
      if (currentSubstance) finalAnnotations.push(currentSubstance)
      for (const child of node.children) walk(child, nextPath)
      return
    }
    paths.push(nextPath)
    if (node.status === 'resolved' && node.annotation) finalAnnotations.push(clean(node.annotation))
    else unresolved.push(step)
  }
  walk(root)

  return {
    root,
    paths,
    finalAnnotations: [...new Set(finalAnnotations)],
    unresolved,
    hasReferences: Boolean(root.children?.length),
  }
}

export function compactResolution(resolution) {
  if (!resolution?.hasReferences) return null
  return {
    paths: resolution.paths.map((path) => path.map((step) => ({
      article: step.title,
      route: step.route,
      note: step.number,
      annotation: clean(step.annotation),
      status: step.status,
    }))),
    finalAnnotations: resolution.finalAnnotations,
    unresolved: resolution.unresolved,
  }
}
