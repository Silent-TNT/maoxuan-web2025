/**
 * 为四卷各篇批量写入唯一 title / description frontmatter
 * 运行: node scripts/generate-seo-frontmatter.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VOLUMES = ['第一卷', '第二卷', '第三卷', '第四卷']

/** 名篇：标题加检索词，description 优先用名句 */
const HIGHLIGHTS = {
  '中国社会各阶级的分析': {
    title: '中国社会各阶级的分析全文 - 谁是我们的敌人朋友 | 毛选第一卷',
    desc: '在线阅读《中国社会各阶级的分析》全文。“谁是我们的敌人？谁是我们的朋友？”革命首要问题。第一卷经典，无广告排版。',
  },
  '矛盾论': {
    title: '矛盾论全文在线阅读 - 对立统一法则 | 毛泽东选集第一卷',
    desc: '《矛盾论》完整原文：唯物辩证法核心，论矛盾的普遍性与特殊性。第一卷哲学名篇，无广告、手机可读。',
  },
  '实践论': {
    title: '实践论全文 - 认识与实践辩证关系 | 毛选第一卷在线阅读',
    desc: '《实践论》全文：论认识与实践、真理与发展的马克思主义认识论名篇。第一卷，纯净无广告阅读体验。',
  },
  '星星之火，可以燎原': {
    title: '星星之火可以燎原全文 - 毛选第一卷经典书信',
    desc: '《星星之火，可以燎原》原文：论中国革命高潮与农村包围城市道路。第一卷名篇，在线无广告阅读。',
  },
  '论持久战': {
    title: '论持久战全文 - 抗日战争战略方针 | 毛选第二卷',
    desc: '《论持久战》全文：驳亡国论与速胜论，阐明抗日战争三阶段。第二卷战略巨著，无广告在线阅读。',
  },
  '为人民服务': {
    title: '为人民服务全文 - 纪念张思德 | 毛泽东选集第三卷',
    desc: '《为人民服务》全文：“全心全意为人民服务”出处。第三卷短篇经典，无广告、手机适配。',
  },
  '愚公移山': {
    title: '愚公移山全文 - 七大闭幕词 | 毛选第三卷在线阅读',
    desc: '《愚公移山》原文：论艰苦奋斗与推翻两座大山。第三卷名篇，完整无广告版在线阅读。',
  },
  '论人民民主专政': {
    title: '论人民民主专政全文 - 建国纲领名篇 | 毛选第四卷',
    desc: '《论人民民主专政》全文：总结革命经验、论新中国国体。第四卷奠基文献，无广告在线阅读。',
  },
  '丢掉幻想，准备斗争': {
    title: '丢掉幻想准备斗争全文 - 评美国白皮书 | 毛选第四卷',
    desc: '《丢掉幻想，准备斗争》全文：论帝国主义本质与中国革命路线。第四卷，无广告完整阅读。',
  },
}

const DESC_TAILS = [
  '毛泽东选集在线阅读，无广告、手机适配。',
  '毛选完整原文，极简排版，支持上一篇/下一篇。',
  '纯净无广告版，适合精读与检索。',
]

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return { fm: null, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { fm: null, body: content }
  const raw = content.slice(4, end)
  const body = content.slice(end + 4).replace(/^\n/, '')
  const fm = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/)
    if (m) fm[m[1]] = m[2].trim()
  }
  return { fm, body }
}

function extractArticleMeta(body, fallbackName) {
  const h1 = body.match(/^#\s+(.+?)\s*$/m)
  let name = (h1?.[1] ?? fallbackName).replace(/\s+/g, ' ').trim()
  name = name.replace(/——.*$/, '').trim()

  const lines = body.split('\n')
  let snippet = ''
  let inBlockquote = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    if (line.startsWith('>')) {
      inBlockquote = true
      continue
    }
    if (inBlockquote && !line.startsWith('>') && line.length < 30) {
      inBlockquote = false
    }
    if (line.startsWith('>')) continue
    if (/^[（(]一九/.test(line) && line.length < 40) continue
    if (line.startsWith('##')) continue
    if (line.startsWith('---')) break
    if (line.startsWith('注')) continue

    let t = line.replace(/^　+/g, '').replace(/\s+/g, '')
    if (t.length < 24) continue
    snippet = t
    break
  }

  if (!snippet) {
    for (const raw of lines) {
      let t = raw.replace(/^　+/g, '').replace(/\s+/g, ' ').trim()
      if (t.length >= 30 && !t.startsWith('#') && !t.startsWith('>')) {
        snippet = t
        break
      }
    }
  }

  return { name, snippet }
}

function trimSnippet(s, max = 72) {
  let t = s.replace(/[""]/g, '').replace(/\s+/g, '')
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const p = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'), cut.lastIndexOf('；'))
  return (p > 28 ? cut.slice(0, p + 1) : cut) + '…'
}

function yamlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function articleLabel(name) {
  return name.startsWith('《') ? name : `《${name}》`
}

function buildTitle(name, vol) {
  const hit = HIGHLIGHTS[name]
  if (hit?.title) return hit.title
  const long = `${name}全文在线阅读 - 毛泽东选集${vol}`
  if (long.length <= 58) return long
  return `${name} - 毛选${vol}全文在线阅读`
}

function buildDescription(name, vol, snippet, fileKey) {
  const hit = HIGHLIGHTS[name]
  if (hit?.desc) return hit.desc

  const label = articleLabel(name)
  const core = trimSnippet(snippet, 68)
  const tail = DESC_TAILS[fileKey % DESC_TAILS.length]
  if (core) {
    return `${label}${vol}完整原文：${core} ${tail}`
  }
  return `在线阅读${label}全文（${vol}）。经典文献原始版本，${tail}`
}

function shouldSkip() {
  return false
}

function processFile(filePath, vol) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { fm, body } = stripFrontmatter(raw)
  if (shouldSkip(fm)) return 'skip'

  const base = path.basename(filePath, '.md')
  const fallbackName = base.replace(/^\d+-/, '')
  const { name, snippet } = extractArticleMeta(body, fallbackName)
  const fileKey = [...base].reduce((a, c) => a + c.charCodeAt(0), 0)

  const title = buildTitle(name, vol)
  const description = buildDescription(name, vol, snippet, fileKey)

  const out = `---\ntitle: ${yamlEscape(title)}\ndescription: ${yamlEscape(description)}\n---\n${body}`
  fs.writeFileSync(filePath, out, 'utf8')
  return 'ok'
}

let ok = 0
let skip = 0
for (const vol of VOLUMES) {
  const dir = path.join(ROOT, vol)
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const r = processFile(path.join(dir, f), vol)
    if (r === 'ok') ok++
    else skip++
  }
}
console.log(`Updated: ${ok}, skipped (already rich): ${skip}`)
