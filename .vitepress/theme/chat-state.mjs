import { ref, watch } from 'vue'

export const WELCOME_TEXT = '随便坐，莫拘束。遇到什么难处了？跟教员讲讲。'
const STORAGE_KEY = 'maoxuan-ai-chat-v1'

function loadStoredMessages() {
  if (typeof window === 'undefined') {
    return [{ role: 'assistant', content: WELCOME_TEXT }]
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return [{ role: 'assistant', content: WELCOME_TEXT }]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ role: 'assistant', content: WELCOME_TEXT }]
    }
    return parsed
  } catch {
    return [{ role: 'assistant', content: WELCOME_TEXT }]
  }
}

export const sharedMessages = ref(loadStoredMessages())
export const sharedIsLoading = ref(false)
export const isModalOpen = ref(false)

if (typeof window !== 'undefined') {
  watch(
    sharedMessages,
    (messages) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      } catch {
        /* quota exceeded — ignore */
      }
    },
    { deep: true },
  )
}

export function openChat() {
  isModalOpen.value = true
}

export function closeChat() {
  isModalOpen.value = false
}

function welcomeOnly() {
  return (
    sharedMessages.value.length === 1 &&
    sharedMessages.value[0]?.role === 'assistant' &&
    sharedMessages.value[0]?.content === WELCOME_TEXT
  )
}

export function clearChat() {
  if (sharedIsLoading.value) return
  sharedMessages.value = [{ role: 'assistant', content: WELCOME_TEXT }]
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sharedMessages.value))
    } catch {
      /* ignore */
    }
  }
}

export function canClearChat() {
  return !welcomeOnly()
}
