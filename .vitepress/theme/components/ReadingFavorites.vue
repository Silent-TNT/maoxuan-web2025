<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onContentUpdated, useData, useRoute } from 'vitepress'
import { articleExplanationRequest, isModalOpen, sharedIsLoading } from '../chat-state.mjs'
import { cleanQuoteText, openSharePoster } from '../share-poster.mjs'
import {
  articleTextRange, favoriteArticlePath, locateFavorite, makeFavoriteAnchor,
  readArticleText, readFavorites, saveFavorites, selectedArticleText, watchFavorites,
} from '../favorites.mjs'

type Article = ReturnType<typeof readArticleText>
type Paragraph = Article['paragraphs'][number]
type Anchor = NonNullable<ReturnType<typeof makeFavoriteAnchor>>
type Kind = 'paragraph' | 'quote'

const route = useRoute()
const { page } = useData()
const path = computed(() => favoriteArticlePath(route.path))
const toolbar = ref<{
  text: string
  posterText: string
  quote: Anchor | null
  quoteSaved: boolean
} | null>(null)
const toolbarElement = ref<HTMLElement>()
const toolbarPosition = ref({ left: '12px', top: '12px' })
const announcement = ref('')
const mounted = ref(false)
const buttons = new Map<number, HTMLButtonElement>()
const blocks = new Set<HTMLElement>()
let root: HTMLElement | null = null
let article: Article | null = null
let favorites = readFavorites()
let currentMatches = new Map<string, number>()
let favoriteQuoteRanges: Range[] = []
let observer: MutationObserver | undefined
let resizeObserver: ResizeObserver | undefined
let stopWatching: (() => void) | undefined
let refreshFrame = 0
let jumpFrame = 0
let toastTimer = 0
let jumpTimer = 0
let lastJump = ''
let jumpParagraph: HTMLElement | undefined
let prepareRun = 0
let addBookmarkButton: HTMLButtonElement | null = null

function showMessage(message: string) {
  announcement.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { announcement.value = '' }, 2400)
}

async function refreshSelection() {
  const selection = window.getSelection()
  if (!article || !root || isModalOpen.value || !selection || selection.isCollapsed || !selection.rangeCount) {
    toolbar.value = null
    return
  }
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    toolbar.value = null
    return
  }
  const quote = selectedArticleText(article, range)
  const text = selection.toString().trim()
  const cleaned = cleanQuoteText(text)
  const rect = range.getBoundingClientRect()
  if ((!quote && text.length < 2) || !rect.width || rect.bottom < 0 || rect.top > window.innerHeight) {
    toolbar.value = null
    return
  }
  toolbar.value = {
    text,
    posterText: cleaned.length > 5 && cleaned.length < 1500 ? cleaned : '',
    quote,
    quoteSaved: Boolean(quote && favorites.some((entry) =>
      entry.kind === 'quote' && entry.text === quote.text && currentMatches.get(entry.id) === quote.start,
    )),
  }
  await nextTick()
  const element = toolbarElement.value
  if (!element) return
  const { offsetWidth, offsetHeight } = element
  const above = rect.top - offsetHeight - 9
  const below = rect.bottom + 9
  const preferBelow = window.matchMedia('(pointer: coarse)').matches
  const top = (preferBelow || above < 12) && below + offsetHeight <= window.innerHeight - 12 ? below : above
  toolbarPosition.value = {
    left: Math.max(12, Math.min(window.innerWidth - offsetWidth - 12, rect.left + (rect.width - offsetWidth) / 2)) + 'px',
    top: Math.max(12, Math.min(window.innerHeight - offsetHeight - 12, top)) + 'px',
  }
}

function onScroll() {
  if (toolbar.value || window.getSelection()?.isCollapsed === false) refreshSelection()
}

function setHighlight(name: string, ranges: Range[]) {
  if (!CSS.highlights || typeof Highlight === 'undefined') return
  if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges))
  else CSS.highlights.delete(name)
}

function refreshMarks() {
  favorites = readFavorites()
  currentMatches = new Map()
  favoriteQuoteRanges = []
  if (!article || !path.value) return
  const paragraphStarts = new Set<number>()
  for (const favorite of favorites) {
    if (favorite.path !== path.value) continue
    const start = locateFavorite(favorite, article.text, article.paragraphs)
    if (start === null) continue
    currentMatches.set(favorite.id, start)
    if (favorite.kind === 'paragraph') {
      paragraphStarts.add(start)
    } else {
      const range = articleTextRange(article, start, favorite.text.length)
      if (range) favoriteQuoteRanges.push(range)
    }
  }
  for (const paragraph of article.paragraphs) {
    const saved = paragraphStarts.has(paragraph.start)
    const button = buttons.get(paragraph.start)
    if (!button) continue
    const action = saved ? '取消书签' : '添加书签'
    button.setAttribute('aria-pressed', String(saved))
    button.setAttribute('aria-label', action + '：' + paragraph.text.slice(0, 20))
    button.title = action
  }
  setHighlight('reading-favorite-quote', favoriteQuoteRanges)
}

function toggleFavorite(kind: Kind, anchor: Anchor, { addOnly = false } = {}) {
  if (!article || !path.value) return
  const action = kind === 'quote' ? '划线' : '书签'
  const records = readFavorites()
  const articlePath = path.value
  const existing = records.find((entry) =>
    entry.path === articlePath && entry.kind === kind && entry.text === anchor.text &&
    locateFavorite(entry, article!.text, article!.paragraphs) === anchor.start,
  )
  if (existing && addOnly) {
    showMessage('这段已添加书签')
    return
  }
  const next = existing
    ? records.filter((entry) => entry.id !== existing.id)
    : [{
      ...anchor,
      id: globalThis.crypto.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16)).join('-'),
      kind,
      path: articlePath,
      title: root?.querySelector('h1')?.textContent?.trim() || articlePath.split('/').at(-1)!.replace(/^\d+-/, ''),
      createdAt: Date.now(),
    }, ...records]
  if (!saveFavorites(next)) {
    showMessage(`此浏览器暂时无法保存${action}`)
    return
  }
  refreshMarks()
  showMessage(existing ? `已取消${action}` : kind === 'quote' ? '已划线' : '已添加书签')
}

function toggleParagraph(paragraph: Paragraph, options?: { addOnly?: boolean }) {
  if (!article) return
  const anchor = makeFavoriteAnchor(article.text, paragraph.start, paragraph.end)
  if (anchor) toggleFavorite('paragraph', anchor, options)
}

function bookmarkVisibleParagraph() {
  if (!article || !addBookmarkButton) return
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const top = Math.max(viewportTop, addBookmarkButton.closest('.VPLocalNav')?.getBoundingClientRect().bottom ?? 0)
  const bottom = viewportTop + (viewport?.height ?? window.innerHeight)
  const range = document.createRange()

  const firstVisible = article.paragraphs.find(({ element, text, firstNode, lastNode }, index) => {
    if (index === 0 && /^[（(][〇○零一二三四五六七八九十\d]{4}年.*[）)]$/u.test(text)) return false
    const rect = element.getBoundingClientRect()
    if (rect.bottom <= top || rect.top >= bottom) return false
    range.setStart(firstNode.node, firstNode.offset)
    range.setEnd(lastNode.node, lastNode.offset + lastNode.end - lastNode.start)
    return Array.from(range.getClientRects()).some((line) =>
      line.width > 0 && line.height > 0 && line.bottom > top && line.top < bottom,
    )
  })

  if (firstVisible) toggleParagraph(firstVisible, { addOnly: true })
  else showMessage('当前屏幕没有可添加书签的正文')
}

function attachAddBookmarkButton() {
  const menu = document.querySelector('.VPLocalNav.has-sidebar > .container')
  if (!menu || addBookmarkButton?.parentElement === menu) return
  addBookmarkButton?.remove()
  addBookmarkButton = document.createElement('button')
  addBookmarkButton.type = 'button'
  addBookmarkButton.className = 'reading-add-bookmark'
  addBookmarkButton.textContent = '添加书签'
  addBookmarkButton.addEventListener('click', bookmarkVisibleParagraph)
  menu.insertBefore(addBookmarkButton, menu.querySelector(':scope > .VPLocalNavOutlineDropdown'))
}

function saveSelection() {
  const quote = toolbar.value?.quote
  if (!quote) return
  toggleFavorite('quote', quote)
  refreshSelection()
}

function dismissSelection() {
  window.getSelection()?.removeAllRanges()
  toolbar.value = null
}

function explainSelection() {
  const text = toolbar.value?.text
  if (!text) return
  articleExplanationRequest.value = text
  dismissSelection()
}

function shareSelection() {
  const text = toolbar.value?.posterText
  if (!text) return
  openSharePoster({ quote: text, source: page.value.title })
  dismissSelection()
}

function clearJumpMark() {
  window.clearTimeout(jumpTimer)
  jumpParagraph?.classList.remove('is-favorite-jump')
  jumpParagraph = undefined
  setHighlight('reading-favorite-jump', [])
}

function jumpToFavorite() {
  const hash = window.location.hash
  const match = /^#favorite-([\w-]+)$/.exec(hash)
  if (!match || !article || !path.value || lastJump === hash) return
  lastJump = hash
  clearJumpMark()
  const favorite = favorites.find((entry) => entry.id === match[1] && entry.path === path.value)
  const start = favorite ? currentMatches.get(favorite.id) : undefined
  if (!favorite || start === undefined) {
    showMessage(favorite ? '原文已变动，已打开所在文章' : '在此浏览器中找不到这条收藏')
    return
  }

  const range = articleTextRange(article, start, favorite.text.length)
  const paragraph = article.paragraphs.find((item) => item.start <= start && item.end > start)
  if (!range || !paragraph) return
  const header = document.querySelector('.VPNav')?.getBoundingClientRect().height ?? 64
  const localNav = document.querySelector('.VPLocalNav')?.getBoundingClientRect().height ?? 0
  const top = range.getClientRects()[0]?.top ?? paragraph.element.getBoundingClientRect().top
  window.scrollBy({ top: top - header - localNav - 20, behavior: 'instant' })
  if (CSS.highlights && typeof Highlight !== 'undefined') {
    setHighlight('reading-favorite-jump', [range])
  } else {
    jumpParagraph = paragraph.element
    jumpParagraph.classList.add('is-favorite-jump')
  }
  jumpTimer = window.setTimeout(clearJumpMark, 2400)
}

function scheduleJump() {
  cancelAnimationFrame(jumpFrame)
  jumpFrame = requestAnimationFrame(jumpToFavorite)
}

function updateButtonPositions() {
  if (!article || !root) return
  const range = document.createRange()
  const blockRects = new Map<HTMLElement, DOMRect>()
  const textRight = root.getBoundingClientRect().right
  const notes = document.querySelector('.VPDoc .margin-notes-rail')
  const notesLeft = notes?.getBoundingClientRect().left
  const centerX = notesLeft != null && notesLeft - textRight >= 44
    ? (textRight + notesLeft) / 2
    : Math.min(textRight + 26, window.innerWidth - 22)
  const positions = article.paragraphs.map(({ firstNode, lastNode, element, start }) => {
    let block = blockRects.get(element)
    if (!block) {
      block = element.getBoundingClientRect()
      blockRects.set(element, block)
    }
    range.setStart(firstNode.node, firstNode.offset)
    range.setEnd(lastNode.node, lastNode.offset + lastNode.end - lastNode.start)
    const rect = range.getBoundingClientRect()
    return { start, top: rect.top + rect.height / 2 - block.top, left: centerX - block.left }
  })
  for (const { start, top, left } of positions) {
    const button = buttons.get(start)
    button?.style.setProperty('top', top + 'px')
    button?.style.setProperty('--favorite-center-x', left + 'px')
  }
}

function updateArticle() {
  if (!root) return
  article = readArticleText(root)
  const previousBlocks = new Set(blocks.keys())
  blocks.clear()
  const paragraphs = new Map(article.paragraphs.map((item) => [item.start, item]))
  for (const [start, button] of buttons) {
    if (paragraphs.get(start)?.element === button.parentElement) continue
    button.remove()
    buttons.delete(start)
  }
  for (const paragraph of article.paragraphs) {
    const { element, start } = paragraph
    blocks.add(element)
    previousBlocks.delete(element)
    if (buttons.has(start)) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'reading-favorite-heart favorite-heart-icon'
    button.dataset.favoriteStart = String(start)
    element.classList.add('reading-favorite-paragraph')
    element.append(button)
    buttons.set(start, button)
  }
  for (const element of previousBlocks) element.classList.remove('reading-favorite-paragraph')
  updateButtonPositions()
  refreshMarks()
}

function onArticleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.classList.contains('reading-favorite-heart')) {
    const paragraph = article?.paragraphs.find((item) => item.start === Number(target.dataset.favoriteStart))
    if (paragraph) toggleParagraph(paragraph)
    return
  }
  if (event.defaultPrevented || event.detail > 1 || event.shiftKey || event.altKey ||
      event.ctrlKey || event.metaKey || target.closest('a, button, .margin-note-anchor')) return

  const selection = window.getSelection()
  if (!selection?.isCollapsed) return
  const { clientX, clientY } = event
  let match: Range | undefined
  for (const range of favoriteQuoteRanges) {
    const containsClick = Array.from(range.getClientRects()).some((rect) =>
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
    )
    if (containsClick && (!match || range.toString().length < match.toString().length)) match = range
  }
  if (!match) return
  selection.removeAllRanges()
  selection.addRange(match.cloneRange())
}

function detachArticle() {
  observer?.disconnect()
  resizeObserver?.disconnect()
  cancelAnimationFrame(refreshFrame)
  cancelAnimationFrame(jumpFrame)
  clearJumpMark()
  setHighlight('reading-favorite-quote', [])
  favoriteQuoteRanges = []
  toolbar.value = null
  addBookmarkButton?.remove()
  addBookmarkButton = null
  root?.removeEventListener('click', onArticleClick)
  for (const button of buttons.values()) button.remove()
  for (const element of blocks.keys()) element.classList.remove('reading-favorite-paragraph')
  buttons.clear()
  blocks.clear()
  root = null
  article = null
  lastJump = ''
}

async function prepareArticle() {
  const run = ++prepareRun
  await nextTick()
  if (run !== prepareRun) return
  const nextRoot = path.value ? document.querySelector<HTMLElement>('.VPDoc .vp-doc') : null
  if (root !== nextRoot) {
    detachArticle()
    root = nextRoot
    if (!root) return
    root.addEventListener('click', onArticleClick)
    observer = new MutationObserver((changes) => {
      const includesArticleContent = changes.some((change) =>
        change.type === 'characterData' ||
        [...change.addedNodes, ...change.removedNodes].some((node) =>
          !(node instanceof HTMLElement && node.classList.contains('reading-favorite-heart')),
        ),
      )
      if (!includesArticleContent) return
      cancelAnimationFrame(refreshFrame)
      refreshFrame = requestAnimationFrame(updateArticle)
    })
    observer.observe(root, { childList: true, characterData: true, subtree: true })
    resizeObserver = new ResizeObserver(updateButtonPositions)
    resizeObserver.observe(root)
  }
  updateArticle()
  attachAddBookmarkButton()
  scheduleJump()
}

function onHashChange() {
  lastJump = ''
  scheduleJump()
}

watch(isModalOpen, (open) => {
  if (open) toolbar.value = null
})
watch(path, () => {
  detachArticle()
  prepareArticle()
}, { flush: 'post' })
onContentUpdated(prepareArticle)
onMounted(() => {
  mounted.value = true
  prepareArticle()
  stopWatching = watchFavorites(refreshMarks)
  document.addEventListener('selectionchange', refreshSelection)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => {
  prepareRun += 1
  detachArticle()
  stopWatching?.()
  window.clearTimeout(toastTimer)
  document.removeEventListener('selectionchange', refreshSelection)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div
      v-if="toolbar"
      ref="toolbarElement"
      class="reading-selection-toolbar"
      :style="toolbarPosition"
      role="group"
      aria-label="选中文本操作"
      @pointerdown.prevent
    >
      <button
        v-if="toolbar.text.length >= 2"
        type="button"
        aria-label="解释这段"
        :disabled="sharedIsLoading"
        @click="explainSelection"
      >
        解释
      </button>
      <button v-if="toolbar.posterText" type="button" title="生成分享卡片" @click="shareSelection">
        分享
      </button>
      <button
        v-if="toolbar.quote"
        type="button"
        class="selection-favorite-btn"
        aria-label="划线"
        :aria-pressed="toolbar.quoteSaved"
        :title="toolbar.quoteSaved ? '取消划线' : '划线'"
        @click="saveSelection"
      >
        {{ toolbar.quoteSaved ? '已划线' : '划线' }}
      </button>
    </div>
    <div class="reading-favorite-feedback" :class="{ 'is-visible': announcement }" role="status">
      {{ announcement }}
    </div>
  </Teleport>
</template>

<style>
.reading-add-bookmark {
  display: none;
}

@media (max-width: 959px) {
  .reading-add-bookmark {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    padding-inline: 10px;
    color: var(--vp-c-text-2);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }

  .reading-add-bookmark:hover {
    color: var(--vp-c-text-1);
  }
}

.reading-favorite-paragraph {
  position: relative;
}

.reading-favorite-heart {
  display: none;
}

.reading-favorite-heart::before {
  content: none;
}

.reading-favorite-heart[aria-pressed='true'] {
  position: absolute;
  left: -10px;
  display: block;
  width: 3px;
  height: 18px;
  transform: translateY(-50%);
  border-radius: 3px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 55%, transparent);
  pointer-events: none;
}

.reading-favorite-heart:focus-visible,
.reading-selection-toolbar button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -3px;
}

.reading-selection-toolbar {
  position: fixed;
  z-index: 9998;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  max-width: calc(100vw - 24px);
  width: max-content;
  padding: 4px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 4px 14px rgb(0 0 0 / 10%);
}

.reading-selection-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 7px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  user-select: none;
}

.reading-selection-toolbar button:hover:not(:disabled) {
  background: var(--vp-c-bg-soft);
}

.selection-favorite-btn {
  position: relative;
  min-width: 66px;
}

.selection-favorite-btn:not(:first-child) {
  margin-inline-start: 5px;
}

.selection-favorite-btn:not(:first-child)::before {
  position: absolute;
  inset-inline-start: -4px;
  width: 1px;
  height: 16px;
  background: var(--vp-c-divider);
  content: '';
}

.reading-selection-toolbar button:disabled {
  opacity: 0.55;
  cursor: default;
}

@media (pointer: coarse) {
  .reading-selection-toolbar button {
    min-height: 44px;
  }
}

.reading-favorite-feedback {
  position: fixed;
  z-index: 69;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.reading-favorite-feedback.is-visible {
  padding: 9px 14px;
  border-radius: 8px;
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  font-size: 14px;
  white-space: nowrap;
}

::highlight(reading-favorite-quote) {
  background-color: rgb(215 163 71 / 24%);
}

::highlight(reading-favorite-jump) {
  background-color: color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent);
}

.reading-favorite-paragraph.is-favorite-jump {
  background-color: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent);
}

@media (hover: hover) and (pointer: fine) and (min-width: 960px) {
  .vp-doc .reading-favorite-heart {
    position: absolute;
    left: var(--favorite-center-x, calc(100% + 24px));
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    width: 44px;
    height: min(38px, calc(var(--reading-font-size) * 1.9));
    margin: 0;
    text-indent: 0;
    border-radius: 999px;
    background: transparent;
    pointer-events: auto;
  }

  .vp-doc .reading-favorite-heart::before {
    content: '';
  }

  .reading-favorite-heart:hover {
    background: var(--vp-c-brand-soft);
  }
}

@media (hover: hover) and (pointer: fine) and (min-width: 1280px) {
  .reading-article-page.has-margin-notes-demo {
    --reading-column-gap: 44px;
  }

  .reading-article-page.has-margin-notes-demo .margin-note-card::before {
    width: 10px;
  }
}
</style>
