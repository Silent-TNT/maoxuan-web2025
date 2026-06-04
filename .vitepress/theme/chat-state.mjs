import { ref, computed, watch } from 'vue'

export const WELCOME_TEXT = '随便坐，莫拘束。遇到什么难处了？跟教员讲讲。'

const STORAGE_KEY_V2 = 'maoxuan-ai-chat-v2'
const STORAGE_KEY_V1 = 'maoxuan-ai-chat-v1'
const MAX_SESSIONS = 30
const MAX_MESSAGES_PER_SESSION = 100
const MAX_TITLE_LENGTH = 24

function defaultMessages() {
  return [{ role: 'assistant', content: WELCOME_TEXT }]
}

function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function truncateTitle(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  if (!t) return '未命名对话'
  return t.length > MAX_TITLE_LENGTH ? `${t.slice(0, MAX_TITLE_LENGTH)}…` : t
}

function welcomeOnlyMessages(messages) {
  return (
    messages.length === 1 &&
    messages[0]?.role === 'assistant' &&
    messages[0]?.content === WELCOME_TEXT
  )
}

function deriveTitleFromMessages(messages) {
  for (const m of messages) {
    if (m.role === 'user' && m.content?.trim()) {
      return truncateTitle(m.content)
    }
  }
  return '未命名对话'
}

function createEmptySession() {
  const now = Date.now()
  return {
    id: newSessionId(),
    title: '新对话',
    createdAt: now,
    updatedAt: now,
    messages: defaultMessages(),
  }
}

function trimMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return defaultMessages()
  if (messages.length <= MAX_MESSAGES_PER_SESSION) return messages
  const welcome = messages[0]?.content === WELCOME_TEXT ? messages[0] : null
  const rest = messages.filter((m, i) => !(i === 0 && welcome))
  const trimmed = rest.slice(-MAX_MESSAGES_PER_SESSION + (welcome ? 1 : 0))
  return welcome ? [welcome, ...trimmed] : trimmed
}

function loadV1Messages() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_V1)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function migrateFromV1() {
  const messages = loadV1Messages()
  if (!messages) return null
  const now = Date.now()
  const session = {
    id: newSessionId(),
    title: welcomeOnlyMessages(messages) ? '新对话' : deriveTitleFromMessages(messages),
    createdAt: now,
    updatedAt: now,
    messages: trimMessages(messages),
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY_V1)
  } catch {
    /* ignore */
  }
  return session
}

function loadStore() {
  if (typeof window === 'undefined') {
    const session = createEmptySession()
    return { version: 2, activeSessionId: session.id, sessions: [session] }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        parsed?.version === 2 &&
        Array.isArray(parsed.sessions) &&
        parsed.sessions.length > 0 &&
        parsed.activeSessionId
      ) {
        const sessions = parsed.sessions.map((s) => ({
          id: s.id || newSessionId(),
          title: truncateTitle(s.title || '未命名对话'),
          createdAt: s.createdAt || Date.now(),
          updatedAt: s.updatedAt || Date.now(),
          messages: trimMessages(s.messages),
        }))
        const activeId = sessions.some((s) => s.id === parsed.activeSessionId)
          ? parsed.activeSessionId
          : sessions[0].id
        const emptySessions = sessions.filter((s) => welcomeOnlyMessages(s.messages))
        if (emptySessions.length > 1) {
          const keepEmptyId = emptySessions.some((s) => s.id === activeId)
            ? activeId
            : emptySessions[0].id
          const pruned = sessions.filter(
            (s) => !welcomeOnlyMessages(s.messages) || s.id === keepEmptyId,
          )
          return { version: 2, activeSessionId: activeId, sessions: pruned }
        }
        return { version: 2, activeSessionId: activeId, sessions }
      }
    }
  } catch {
    /* fall through */
  }

  const migrated = migrateFromV1()
  if (migrated) {
    return { version: 2, activeSessionId: migrated.id, sessions: [migrated] }
  }

  const session = createEmptySession()
  return { version: 2, activeSessionId: session.id, sessions: [session] }
}

const store = ref(loadStore())

function getActiveSession() {
  return store.value.sessions.find((s) => s.id === store.value.activeSessionId)
}

function persistStore() {
  if (typeof window === 'undefined') return
  if (store.value.sessions.length > MAX_SESSIONS) {
    const activeId = store.value.activeSessionId
    const sorted = [...store.value.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
    let kept = sorted.slice(0, MAX_SESSIONS)
    if (!kept.some((s) => s.id === activeId)) {
      const active = store.value.sessions.find((s) => s.id === activeId)
      if (active) {
        kept = [active, ...kept.slice(0, MAX_SESSIONS - 1)]
      }
    }
    store.value.sessions = kept
    if (!kept.some((s) => s.id === store.value.activeSessionId)) {
      store.value.activeSessionId = kept[0].id
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store.value))
  } catch (err) {
    console.warn('[chat] localStorage 写入失败:', err?.message || err)
  }
}

let syncingFromStore = false

function syncMessagesToActive() {
  const session = getActiveSession()
  if (!session) return
  syncingFromStore = true
  sharedMessages.value = [...session.messages]
  syncingFromStore = false
}

function syncActiveToStore(messages) {
  const session = getActiveSession()
  if (!session) return
  session.messages = trimMessages(messages)
  session.updatedAt = Date.now()
  const firstUser = session.messages.find((m) => m.role === 'user' && m.content?.trim())
  if (firstUser && (session.title === '新对话' || session.title === '未命名对话')) {
    session.title = deriveTitleFromMessages(session.messages)
  }
  persistStore()
}

const activeSession = getActiveSession()
export const sharedMessages = ref(
  activeSession ? [...activeSession.messages] : defaultMessages(),
)
export const sharedIsLoading = ref(false)
export const isModalOpen = ref(false)

export const activeSessionId = computed(() => store.value.activeSessionId)

export const chatSessions = computed(() =>
  [...store.value.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      isEmpty: welcomeOnlyMessages(s.messages),
    })),
)

if (typeof window !== 'undefined') {
  watch(
    sharedMessages,
    (messages) => {
      if (syncingFromStore) return
      syncActiveToStore(messages)
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
  return welcomeOnlyMessages(sharedMessages.value)
}

export function canClearChat() {
  return !welcomeOnly()
}

export function clearChat() {
  if (sharedIsLoading.value) return
  sharedMessages.value = defaultMessages()
}

function guardWhileLoading() {
  return sharedIsLoading.value
}

export function isSessionEmpty(messages) {
  return welcomeOnlyMessages(messages)
}

export function canCreateSession() {
  if (guardWhileLoading()) return false
  const active = getActiveSession()
  if (!active) return true
  return !isSessionEmpty(active.messages)
}

export function createSession() {
  if (guardWhileLoading()) return 'loading'
  const active = getActiveSession()
  if (active && isSessionEmpty(active.messages)) {
    return 'empty_active'
  }

  store.value.sessions = store.value.sessions.filter(
    (s) =>
      s.id === store.value.activeSessionId || !isSessionEmpty(s.messages),
  )

  const session = createEmptySession()
  store.value.sessions.unshift(session)
  store.value.activeSessionId = session.id
  persistStore()
  syncMessagesToActive()
  return 'created'
}

export function switchSession(id) {
  if (guardWhileLoading()) return
  if (id === store.value.activeSessionId) return
  const session = store.value.sessions.find((s) => s.id === id)
  if (!session) return
  store.value.activeSessionId = id
  persistStore()
  syncMessagesToActive()
}

export function deleteSession(id) {
  if (guardWhileLoading()) return
  if (store.value.sessions.length <= 1) return
  const idx = store.value.sessions.findIndex((s) => s.id === id)
  if (idx < 0) return
  store.value.sessions.splice(idx, 1)
  if (store.value.activeSessionId === id) {
    const sorted = [...store.value.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
    store.value.activeSessionId = sorted[0]?.id || store.value.sessions[0].id
    syncMessagesToActive()
  }
  persistStore()
}

export function renameSession(id, title) {
  const session = store.value.sessions.find((s) => s.id === id)
  if (!session) return
  const trimmed = (title || '').trim()
  if (!trimmed) return
  session.title = truncateTitle(trimmed)
  session.updatedAt = Date.now()
  persistStore()
}

export function getSessionMessages(sessionId) {
  const session = store.value.sessions.find((s) => s.id === sessionId)
  return session?.messages ?? []
}
