<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { inBrowser, onContentUpdated, useRoute } from 'vitepress'
import generatedArticleSelectors from '../../data/note-selectors.generated.json'

type MarginNote = {
  number: number
  text: string
  rawTop: number
  top: number
}

type TextQuoteSelector = {
  exact: string
  prefix?: string
  suffix?: string
}

const generatedSelectors = generatedArticleSelectors as Record<
  string,
  Record<number, TextQuoteSelector[]>
>

const route = useRoute()
const notes = ref<MarginNote[]>([])
const active = ref(false)
let anchors = new Map<number, HTMLElement>()
let sentences = new Map<number, HTMLElement>()
let targets = new Map<number, HTMLElement[]>()
let resizeObserver: ResizeObserver | undefined
let frame = 0
let prepareRun = 0

// 注释真正解释的文字范围。人物、术语和事件只标词组；引文注释标引文本身。
const contradictionNoteTargets: Record<number, string[]> = {
  1: ['就本来的意义讲，辩证法是研究对象的本质自身中的矛盾'],
  2: ['辩证法的本质，又称之为辩证法的核心'],
  3: ['德波林学派'],
  4: ['对于发展（进化）所持的两种基本的（或两种可能的？或两种在历史上常见的？）观点是：（一）认为发展是减少和增加，是重复；（二）认为发展是对立的统一（统一物分成为两个互相排斥的对立，而两个对立又互相关联着）'],
  5: ['天不变，道亦不变'],
  6: ['运动本身就是矛盾'],
  7: ['承认（发现）自然界（精神和社会两者也在内）的一切现象和过程都含有互相矛盾、互相排斥、互相对立的趋向'],
  8: ['生命首先就在于：生物在每一个瞬间是它自身，但却又是别的什么', '高等数学的主要基础之一，就是矛盾', '就是初等数学，也充满着矛盾'],
  9: ['正和负，微分和积分', '作用和反作用', '阳电和阴电', '原子的化合和分解', '阶级斗争'],
  10: ['这应该是一般辩证法的……叙述（以及研究）方法'],
  11: ['具体地分析具体的情况'],
  12: ['知彼知己，百战不殆'],
  13: ['兼听则明，偏信则暗'],
  14: ['宋江三打祝家庄'],
  15: ['木马计'],
  16: ['要真正地认识对象，就必须把握和研究它的一切方面、一切联系和‘媒介’。我们决不会完全地作到这一点，可是要求全面性，将使我们防止错误，防止僵化'],
  17: ['辛亥革命'],
  18: ['日本侵入东北四省'],
  19: ['西安事变'],
  20: ['陈独秀主义'],
  21: ['鸦片战争'],
  22: ['一八九四年的中日战争'],
  23: ['义和团战争'],
  24: ['长征'],
  25: ['没有革命的理论，就不会有革命的运动'],
  26: ['辩证法是这样的一种学说：它研究对立怎样能够是同一的，又怎样成为同一的（怎样变成同一的），——在怎样的条件之下它们互相转化，成为同一的，——为什么人的头脑不应当把这些对立看作死的、凝固的东西，而应当看作生动的、有条件的、可变动的、互相转化的东西'],
  27: ['夸父追日'],
  28: ['羿射九日'],
  29: ['孙悟空七十二变'],
  30: ['《聊斋志异》'],
  31: ['任何神话都是用想象和借助想象以征服自然力，支配自然力，把自然力加以形象化；因而，随着这些自然力之实际上被支配，神话也就消失了'],
  32: ['永久的魅力'],
  33: ['对立的统一（一致、同一、合一），是有条件的、一时的、暂存的、相对的。互相排斥的对立的斗争则是绝对的，正如发展、运动是绝对的一样'],
  34: ['相反相成'],
  35: ['在相对的东西里面有着绝对的东西'],
  36: ['陈独秀、张国焘'],
  37: ['对抗和矛盾断然不同。在社会主义下，对抗消灭了，矛盾存在着'],
}

const articlePath = () => {
  try {
    return decodeURI(route.path).replace(/\.html$/, '').split('#')[0]
  } catch {
    return route.path.replace(/\.html$/, '').split('#')[0]
  }
}

// 人工校准文章使用 W3C TextQuoteSelector 思路：exact 决定范围，
// prefix / suffix 用来消除同词多次出现时的歧义。
const preciseArticleSelectors: Record<string, Record<number, TextQuoteSelector[]>> = {
  ...generatedSelectors,
  '/第一卷/006-星星之火，可以燎原': {
    ...generatedSelectors['/第一卷/006-星星之火，可以燎原'],
    4: [{ exact: '五卅运动', prefix: '这在', suffix: '⑷及其' }],
    6: [{ exact: '蒋桂战争', prefix: '（', suffix: '⑹尚未' }],
  },
  '/第一卷/007-反对本本主义': {
    ...generatedSelectors['/第一卷/007-反对本本主义'],
    1: [{ exact: '没有调查，没有发言权', prefix: '一　', suffix: '⑴' }],
    2: [{ exact: '每事问', prefix: '孔夫子的“', suffix: '”⑵' }],
    3: [{ exact: '李逵', prefix: '那些', suffix: '⑶式的官长' }],
    4: [{
      exact: '红军第四军的同志们一般的都注意调查工作了',
      prefix: '近来',
      suffix: '⑷，但是',
    }],
    5: [{ exact: '自耕农', prefix: '不但要知道', suffix: '⑸，半自耕农' }],
    6: [{ exact: '半自耕农', prefix: '，', suffix: '⑹，佃农' }],
    7: [{
      exact: '离开山头跑向平地了',
      prefix: '斗争的发展使我们',
      suffix: '⑺，我们的身子',
    }],
    8: [{ exact: '“本本”', prefix: '党的第六次全国代表大会的', suffix: '⑻保障' }],
  },
  '/第一卷/018-矛盾论': {
    ...generatedSelectors['/第一卷/018-矛盾论'],
    ...Object.fromEntries(
      Object.entries(contradictionNoteTargets).map(([number, targetTexts]) => [
        number,
        targetTexts.map((exact) => ({ exact })),
      ])
    ),
  },
}

const isArticlePage = () => {
  try {
    return /^\/(第一卷|第二卷|第三卷|第四卷)\//.test(decodeURI(route.path))
  } catch {
    return /^\/(%|第一卷|第二卷|第三卷|第四卷)/.test(route.path)
  }
}

const markerNumber = (marker: string) => {
  const codePoint = marker.codePointAt(0) || 0
  if (codePoint >= 0x2474 && codePoint <= 0x2487) return codePoint - 0x2473
  const match = marker.match(/\d+/)
  return match ? Number(match[0]) : 0
}

// 原文约定：1—20 的脚注使用 ⑴—⒇；（1）（2）等是正文枚举。
// 由于没有同组的 21 以上字符，脚注从（21）开始改用括号数字。
const referenceMarkerPattern = /[⑴-⒇]|[（(](?:2[1-9]|[3-9]\d|[1-9]\d{2,})[）)]/
const referenceMarkerPatternGlobal = () => new RegExp(referenceMarkerPattern.source, 'g')

const isBlockLeadingNumber = (node: Text, index: number) => {
  if (node.data.slice(0, index).trim()) return false
  let sibling = node.previousSibling
  while (sibling) {
    if (sibling.nodeName === 'BR') return true
    if ((sibling.textContent || '').trim()) return false
    sibling = sibling.previousSibling
  }
  return true
}

const rememberTarget = (number: number, element: HTMLElement) => {
  const elements = targets.get(number) || []
  elements.push(element)
  targets.set(number, elements)
}

// Markdown 的软换行在浏览器里会被折叠为空格；语义选择器只把空白视为等价，
// exact 本身仍然要求逐字连续匹配，避免扩大实际划线范围。
const normalizeContextWhitespace = (text: string) => text.replace(/\s+/g, ' ')

const wrapSemanticTargets = (
  root: HTMLElement,
  noteHeading: Element,
  selectors: Record<number, TextQuoteSelector[]>
) => {
  root.querySelectorAll<HTMLElement>('.margin-note-target[data-note]').forEach((element) => {
    const number = Number(element.dataset.note)
    if (number) rememberTarget(number, element)
  })

  Object.entries(selectors).forEach(([noteNumber, noteSelectors]) => {
    const number = Number(noteNumber)
    if (targets.has(number)) return

    noteSelectors.forEach((selector) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let match: Text | undefined
      let matchIndex = -1
      const uniqueCandidates: Array<{ node: Text; index: number }> = []

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const parent = node.parentElement
        if (!parent || parent.closest('.margin-note-target, .margin-note-anchor')) continue
        if (!(node.compareDocumentPosition(noteHeading) & Node.DOCUMENT_POSITION_FOLLOWING)) continue

        let index = node.data.indexOf(selector.exact)
        while (index >= 0) {
          uniqueCandidates.push({ node, index })
          const before = node.data.slice(0, index)
          const after = node.data.slice(index + selector.exact.length)
          const prefixMatches = !selector.prefix || normalizeContextWhitespace(before)
            .endsWith(normalizeContextWhitespace(selector.prefix))
          const suffixMatches = !selector.suffix || normalizeContextWhitespace(after)
            .startsWith(normalizeContextWhitespace(selector.suffix))
          if (prefixMatches && suffixMatches) {
            match = node
            matchIndex = index
            break
          }
          index = node.data.indexOf(selector.exact, index + selector.exact.length)
        }
        if (match) break
      }

      // Markdown 可能把角标或换行拆成相邻文本节点，使 prefix/suffix 无法在
      // 单一节点内严格匹配。exact 在正文中唯一时仍可安全定位；重复则不猜。
      if (!match && uniqueCandidates.length === 1) {
        match = uniqueCandidates[0].node
        matchIndex = uniqueCandidates[0].index
      }
      if (!match) return
      const fragment = document.createDocumentFragment()
      fragment.append(match.data.slice(0, matchIndex))

      const target = document.createElement('span')
      target.className = 'margin-note-target'
      target.dataset.note = String(number)
      target.dataset.match = 'precise'
      target.textContent = selector.exact
      fragment.append(target, match.data.slice(matchIndex + selector.exact.length))
      match.replaceWith(fragment)
      rememberTarget(number, target)
    })
  })
}

const inferTargetText = (prefix: string, noteText: string) => {
  const trimmed = prefix.trimEnd()
  const nearby = trimmed.slice(-36)

  // 编号紧跟在引文、书名或括号内专名之后时，完整边界比词面重复更可靠。
  const quoted = trimmed.match(/([“‘《][^”’》\n]{1,120}[”’》])$/)
  if (quoted) return quoted[1]
  const bracketed = trimmed.match(/[（(]([^（）()\n]{2,24})$/)
  if (bracketed) return bracketed[1]

  const genericTailTerms = new Set([
    '战争', '运动', '会议', '事件', '政策', '思想', '学派', '革命',
    '条约', '政府', '战役', '问题', '工作', '组织', '制度',
  ])

  // 释义型注释通常会在注释开头再次出现被解释的词，优先寻找最长公共后缀。
  for (let length = Math.min(24, nearby.length); length >= 2; length -= 1) {
    const candidate = nearby.slice(-length).replace(/^[，。；：！？、“‘《（(\s]+/, '')
    if (
      candidate.length >= 2 &&
      !genericTailTerms.has(candidate) &&
      !/[，。；：！？\n]/.test(candidate) &&
      noteText.includes(candidate)
    ) {
      return candidate
    }
  }

  // 最后只取最近的短语，避免把整句话全部划线。
  const phrase = (trimmed.split(/[，。；：！？\n]/).pop() || '')
    .trim()
    .replace(/^(?:这在|这是|所谓|关于|对于|至于|其中|例如|如同|这个|那个)/, '')
  return phrase.length > 20 ? phrase.slice(-20) : phrase
}

const wrapInferredTargets = (
  root: HTMLElement,
  noteHeading: Element,
  sourceNotes: Array<{ number: number; text: string }>
) => {
  const noteTexts = new Map(sourceNotes.map((note) => [note.number, note.text]))
  const noteNumbers = new Set(sourceNotes.map((note) => note.number))
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!(node.compareDocumentPosition(noteHeading) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
    if (referenceMarkerPattern.test(node.data)) textNodes.push(node)
  }

  const markerPattern = referenceMarkerPatternGlobal()
  textNodes.forEach((node) => {
    const ranges = Array.from(node.data.matchAll(markerPattern))
      .map((match) => {
        const number = markerNumber(match[0])
        const noteText = noteTexts.get(number)
        if (
          !noteText ||
          !noteNumbers.has(number) ||
          match.index == null ||
          isBlockLeadingNumber(node, match.index)
        ) return null
        const targetText = inferTargetText(node.data.slice(0, match.index), noteText)
        if (!targetText) return null
        const end = node.data.lastIndexOf(targetText, match.index)
        return end < 0 ? null : { number, start: end, end: end + targetText.length }
      })
      .filter((range): range is NonNullable<typeof range> => Boolean(range))
      .sort((a, b) => a.start - b.start)

    if (ranges.length === 0) return
    const fragment = document.createDocumentFragment()
    let cursor = 0
    ranges.forEach((range) => {
      if (range.start < cursor) return
      fragment.append(node.data.slice(cursor, range.start))
      const target = document.createElement('span')
      target.className = 'margin-note-target'
      target.dataset.note = String(range.number)
      target.dataset.match = 'inferred'
      target.textContent = node.data.slice(range.start, range.end)
      fragment.append(target)
      rememberTarget(range.number, target)
      cursor = range.end
    })
    fragment.append(node.data.slice(cursor))
    node.replaceWith(fragment)
  })
}

const wrapReferenceMarkers = (
  root: HTMLElement,
  noteHeading: Element,
  sourceNotes: Array<{ number: number; text: string }>
) => {
  const noteNumbers = new Set(sourceNotes.map((note) => note.number))
  root.querySelectorAll<HTMLElement>('.margin-note-anchor[data-note]').forEach((marker) => {
    const number = Number(marker.dataset.note)
    const sentence = marker.closest<HTMLElement>('.margin-note-sentence')
    if (number && sentence) {
      anchors.set(number, marker)
      sentences.set(number, sentence)
    }
  })

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('.margin-note-anchor')) continue
    if (node.compareDocumentPosition(noteHeading) & Node.DOCUMENT_POSITION_FOLLOWING) {
      const hasReference = Array.from(
        node.data.matchAll(referenceMarkerPatternGlobal())
      ).some((match) => {
        const number = markerNumber(match[0])
        return noteNumbers.has(number) && !isBlockLeadingNumber(node, match.index || 0)
      })
      if (hasReference) textNodes.push(node)
    }
  }

  const markerPattern = referenceMarkerPatternGlobal()
  const sentencePattern = new RegExp(
    `.*?(?:[。！？!?][”’》」』）】]?)(?:${referenceMarkerPattern.source})*|.+$`,
    'g'
  )
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment()
    const sentenceMatches = node.data.match(sentencePattern) || [node.data]
    let sentenceOffset = 0

    for (const sentenceText of sentenceMatches) {
      const referenceMatches = Array.from(sentenceText.matchAll(markerPattern)).filter((match) => {
        const number = markerNumber(match[0])
        return (
          noteNumbers.has(number) &&
          !isBlockLeadingNumber(node, sentenceOffset + (match.index || 0))
        )
      })
      const sentenceNoteNumbers = referenceMatches.map((match) => markerNumber(match[0]))
      if (sentenceNoteNumbers.length === 0) {
        fragment.append(sentenceText)
        sentenceOffset += sentenceText.length
        continue
      }

      const sentence = document.createElement('span')
      sentence.className = 'margin-note-sentence'
      sentence.dataset.notes = sentenceNoteNumbers.join(',')
      let cursor = 0

      for (const match of referenceMatches) {
        const index = match.index || 0
        const number = markerNumber(match[0])
        sentence.append(sentenceText.slice(cursor, index))

        const marker = document.createElement('span')
        marker.className = 'margin-note-anchor'
        marker.dataset.note = String(number)
        marker.textContent = `〔${number}〕`
        marker.setAttribute('aria-label', `注释 ${number}`)
        sentence.append(marker)
        anchors.set(number, marker)
        sentences.set(number, sentence)
        cursor = index + match[0].length
      }

      sentence.append(sentenceText.slice(cursor))
      fragment.append(sentence)
      sentenceOffset += sentenceText.length
    }
    node.replaceWith(fragment)
  }
}

const highlightNote = (number: number) => {
  const exactTargets = targets.get(number)
  if (exactTargets?.length) {
    exactTargets.forEach((target) => target.classList.add('is-note-highlighted'))
  } else {
    sentences.get(number)?.classList.add('is-note-highlighted')
  }
}

const clearHighlight = (number: number) => {
  const exactTargets = targets.get(number)
  if (exactTargets?.length) {
    exactTargets.forEach((target) => target.classList.remove('is-note-highlighted'))
  } else {
    sentences.get(number)?.classList.remove('is-note-highlighted')
  }
}

const createInlineNotes = (sourceNotes: Array<{ number: number; text: string }>) => {
  const groups = new Map<HTMLElement, HTMLElement>()

  sourceNotes.forEach(({ number, text }) => {
    const sentence = sentences.get(number)
    if (!sentence) return
    const heading = sentence.closest<HTMLElement>('h1, h2, h3, h4, h5, h6')
    const placement = heading || sentence

    let group = groups.get(placement)
    if (!group) {
      group = document.createElement('span')
      group.className = 'margin-note-inline-group'
      placement.insertAdjacentElement('afterend', group)
      groups.set(placement, group)
    }

    const item = document.createElement('span')
    item.className = 'margin-note-inline-item'

    const marker = document.createElement('span')
    marker.className = 'margin-note-inline-number'
    marker.textContent = `注〔${number}〕`

    const content = document.createElement('span')
    content.className = 'margin-note-inline-text'
    content.textContent = text

    item.append(marker, content)
    group.append(item)
  })
}

const calculatePositions = async () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(async () => {
    const aside = document.querySelector<HTMLElement>('.VPDoc .aside')
    if (!aside || !active.value) return

    const asideTop = aside.getBoundingClientRect().top
    notes.value = notes.value.map((note) => {
      const anchor = anchors.get(note.number)
      const rawTop = anchor
        ? anchor.getBoundingClientRect().top - asideTop - 6
        : note.rawTop
      return { ...note, rawTop, top: rawTop }
    })

    await nextTick()
    let previousBottom = 0
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.margin-note-card')
    )

    notes.value = notes.value.map((note, index) => {
      const cardHeight = cards[index]?.offsetHeight || 0
      const top = Math.max(note.rawTop, previousBottom)
      previousBottom = top + cardHeight + 14
      return { ...note, top }
    })
  })
}

const clearPageState = () => {
  active.value = false
  notes.value = []
  anchors.clear()
  sentences.forEach((sentence) => sentence.classList.remove('is-note-highlighted'))
  sentences.clear()
  targets.forEach((elements) => {
    elements.forEach((target) => target.classList.remove('is-note-highlighted'))
  })
  targets.clear()
  document.querySelectorAll('.margin-note-inline-group').forEach((element) => element.remove())
  document.body.classList.remove('has-margin-notes-demo')
  document.body.classList.remove('reading-article-page')
  resizeObserver?.disconnect()
  resizeObserver = undefined
}

const prepare = async () => {
  const run = ++prepareRun
  clearPageState()
  if (!isArticlePage()) return

  await nextTick()
  if (run !== prepareRun) return
  const root = document.querySelector<HTMLElement>('.vp-doc')
  const aside = document.querySelector<HTMLElement>('.VPDoc .aside')
  if (!root || !aside) return
  document.body.classList.add('reading-article-page')

  const paragraphs = Array.from(root.querySelectorAll('p'))
  const noteBlock = paragraphs.find((element) =>
    /^注\s*释/.test((element.textContent || '').replace(/　/g, ' ').trim())
  )
  if (!noteBlock) return

  const lines: string[] = []
  let line = ''
  noteBlock.childNodes.forEach((node) => {
    if (node.nodeName === 'BR') {
      lines.push(line)
      line = ''
    } else {
      line += node.textContent || ''
    }
  })
  lines.push(line)

  const sourceNotes = lines
    .map((text) => {
      const match = text.trim().match(/^〔(\d+)〕\s*(.+)$/s)
      return match ? { number: Number(match[1]), text: match[2].trim() } : null
    })
    .filter((note): note is NonNullable<typeof note> => Boolean(note))
  if (sourceNotes.length === 0) return

  noteBlock.classList.add('margin-note-source')
  noteBlock.previousElementSibling?.classList.add('margin-note-source-divider')

  const preciseSelectors = preciseArticleSelectors[articlePath()]
  if (preciseSelectors) {
    wrapSemanticTargets(root, noteBlock, preciseSelectors)
  }
  const inferredNotes = sourceNotes.filter((note) => !preciseSelectors?.[note.number])
  if (inferredNotes.length > 0) wrapInferredTargets(root, noteBlock, inferredNotes)
  wrapReferenceMarkers(root, noteBlock, sourceNotes)
  createInlineNotes(sourceNotes)
  notes.value = sourceNotes.map(({ number, text }) => ({
    number,
    text,
    rawTop: 0,
    top: 0,
  }))
  active.value = true
  document.body.classList.add('has-margin-notes-demo')

  await nextTick()
  calculatePositions()

  resizeObserver = new ResizeObserver(calculatePositions)
  resizeObserver.observe(root)
}

onMounted(prepare)
onContentUpdated(prepare)
if (inBrowser) window.addEventListener('resize', calculatePositions)

onBeforeUnmount(() => {
  prepareRun += 1
  clearPageState()
  cancelAnimationFrame(frame)
  if (inBrowser) window.removeEventListener('resize', calculatePositions)
})
</script>

<template>
  <Teleport v-if="active" to=".VPDoc .aside">
    <aside class="margin-notes-rail" aria-label="原文注释">
      <div
        v-for="note in notes"
        :key="note.number"
        class="margin-note-card"
        :class="{ 'is-shifted': note.top > note.rawTop + 4 }"
        :data-note="note.number"
        :style="{ top: `${note.top}px` }"
        @mouseenter="highlightNote(note.number)"
        @mouseleave="clearHighlight(note.number)"
      >
        <span class="margin-note-number">〔{{ note.number }}〕</span>
        <span class="margin-note-text">{{ note.text }}</span>
      </div>
    </aside>
  </Teleport>
</template>
