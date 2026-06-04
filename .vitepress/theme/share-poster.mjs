import { ref } from 'vue'

/** @type {import('vue').Ref<{ quote: string, source: string, blocks?: { role: string, text: string }[], id: number } | null>} */
export const sharePosterRequest = ref(null)

const CITATION_RE = /([\(（\[【][^\)）\]】]{0,5}\d+[^\)）\]】]{0,5}[\)）\]】]|[⑴-⒇])/g

export function cleanQuoteText(text) {
  return (text || '').replace(CITATION_RE, '').trim()
}

export function extractShareQuote(messages, welcomeText) {
  if (!Array.isArray(messages)) return ''
  const assistants = messages.filter(
    (m) => m.role === 'assistant' && m.content && m.content !== welcomeText,
  )
  if (!assistants.length) return ''
  const last = assistants[assistants.length - 1]
  let text = cleanQuoteText(last.content)
  if (text.length < 5 && assistants.length > 1) {
    text = cleanQuoteText(assistants[assistants.length - 2].content)
  }
  if (text.length > 1500) {
    text = `${text.slice(0, 1497)}…`
  }
  return text
}

/**
 * @param {{ quote?: string, blocks?: { role: string, text: string }[], source?: string }} payload
 * @returns {boolean}
 */
export function openSharePoster({ quote, blocks, source = '教员咨询室' }) {
  const src = (source || '教员咨询室').trim() || '教员咨询室'

  if (blocks?.length) {
    const total = blocks.reduce((n, b) => n + (b.text?.length || 0), 0)
    if (total < 5) return false
    sharePosterRequest.value = {
      quote: '',
      blocks,
      source: src,
      id: Date.now(),
    }
    return true
  }

  const text = cleanQuoteText(quote)
  if (text.length < 5) return false
  const trimmed = text.length > 1500 ? `${text.slice(0, 1497)}…` : text
  sharePosterRequest.value = {
    quote: trimmed,
    blocks: [],
    source: src,
    id: Date.now(),
  }
  return true
}
