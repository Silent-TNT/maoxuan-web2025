import { ref, computed } from 'vue'
import { cleanQuoteText, openSharePoster } from './share-poster.mjs'

const MAX_QUOTE_LENGTH = 1500

export const sharePicker = ref({
  visible: false,
  sessionId: null,
  items: [],
})

export const sharePickerQuoteLength = computed(() => {
  if (!sharePicker.value.visible) return 0
  return buildShareBlocks(sharePicker.value.items).reduce((n, b) => n + b.text.length, 0)
})

function stripMarkdownLite(text) {
  return (text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function previewText(text, max = 80) {
  const plain = stripMarkdownLite(cleanQuoteText(text)).replace(/\s+/g, ' ')
  if (plain.length <= max) return plain
  return `${plain.slice(0, max)}…`
}

/**
 * @param {string} sessionId
 * @param {Array<{ role: string, content: string }>} messages
 * @param {string} welcomeText
 * @returns {boolean}
 */
export function openSharePicker(sessionId, messages, welcomeText) {
  const items = (messages || [])
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m?.content && m.content !== welcomeText)
    .map(({ m, index }) => ({
      index,
      role: m.role,
      content: m.content,
      selected: true,
      preview: previewText(m.content),
      label: m.role === 'user' ? '问' : '答',
    }))

  if (!items.length) return false

  sharePicker.value = {
    visible: true,
    sessionId,
    items,
  }
  return true
}

export function closeSharePicker() {
  sharePicker.value.visible = false
  sharePicker.value.items = []
  sharePicker.value.sessionId = null
}

export function toggleShareItem(index) {
  sharePicker.value.items = sharePicker.value.items.map((i) =>
    i.index === index ? { ...i, selected: !i.selected } : i,
  )
}

export function setAllShareItems(selected) {
  sharePicker.value.items = sharePicker.value.items.map((i) => ({
    ...i,
    selected,
  }))
}

/**
 * @returns {{ role: string, text: string }[]}
 */
export function buildShareBlocks(items) {
  const selected = items.filter((i) => i.selected)
  const blocks = []
  let totalLen = 0

  for (const item of selected) {
    const text = stripMarkdownLite(cleanQuoteText(item.content))
    if (!text) continue
    const blockLen = text.length + (item.role === 'user' ? 2 : 2)
    if (totalLen + blockLen > MAX_QUOTE_LENGTH) {
      const remain = MAX_QUOTE_LENGTH - totalLen - 1
      if (remain > 10) {
        blocks.push({
          role: item.role,
          text: `${text.slice(0, remain)}…`,
        })
      }
      break
    }
    blocks.push({ role: item.role, text })
    totalLen += text.length
  }

  return blocks
}

/**
 * @returns {boolean}
 */
export function confirmSharePicker() {
  const { items } = sharePicker.value
  const selectedCount = items.filter((i) => i.selected).length
  if (!selectedCount) return false

  const blocks = buildShareBlocks(items)
  if (!blocks.length || blocks.reduce((n, b) => n + b.text.length, 0) < 5) return false

  const ok = openSharePoster({ blocks, source: '教员咨询室' })
  if (ok) closeSharePicker()
  return ok
}
