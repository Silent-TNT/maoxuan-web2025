<template>
  <div v-if="mode === 'inline' && isHome" class="chat-trigger-wrapper">
    <div class="chat-trigger-container">
      <div class="chat-trigger-card" @click="openModal">
        <div class="trigger-header">
          <span class="icon">★</span>
          <span class="title">教员咨询室</span>
        </div>
        <div class="trigger-fake-input">
          <span class="placeholder">问问教员</span>
          <div class="send-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="mode === 'float'" class="chat-float-wrapper" :class="{ 'is-home': isHome }">
    <button v-if="!isHome" class="chat-toggle-btn" @click="openModal">
      ★ 咨询教员
    </button>

    <ClientOnly>
      <Teleport to="body">
        <Transition name="fade-scale">
          <div v-if="isModalOpen" class="chat-modal-overlay">
            <div class="chat-modal-backdrop" @click.self="closeModal" />
            <div ref="chatModalWindow" class="chat-modal-window">
              <div class="modal-header">
                <div class="modal-header-left">
                  <span class="icon">★</span>
                  <span class="title">教员咨询室</span>
                </div>
                <div class="modal-header-actions">
                  <button
                    type="button"
                    class="history-toggle-btn"
                    :class="{ active: showSessionSidebar }"
                    @click="toggleSessionSidebar"
                  >
                    {{ showSessionSidebar ? '收起列表' : '历史对话' }}
                  </button>
                  <button
                    type="button"
                    class="new-chat-btn"
                    :disabled="sharedIsLoading"
                    @click="handleNewSession"
                  >
                    新对话
                  </button>
                  <a
                    href="/donate"
                    class="spark-link-btn"
                    @click="onSparkDonateClick"
                  >
                    注入星火
                  </a>
                  <button type="button" class="close-text-btn" @click="closeModal">
                    收起
                  </button>
                </div>
              </div>

              <div class="chat-modal-body">
                <aside
                  v-show="showSessionSidebar"
                  class="session-sidebar"
                >
                  <button
                    type="button"
                    class="sidebar-new-btn"
                    :disabled="sharedIsLoading"
                    @click="handleNewSession"
                  >
                    + 新对话
                  </button>
                  <ul class="session-list">
                    <li
                      v-for="session in chatSessions"
                      :key="session.id"
                      :class="['session-item', { active: session.id === activeSessionId }]"
                    >
                      <button
                        type="button"
                        class="session-select-btn"
                        :disabled="sharedIsLoading"
                        @click="handleSwitchSession(session.id)"
                      >
                        <span class="session-title">{{ session.title }}</span>
                      </button>
                      <div class="session-menu-wrap">
                        <button
                          type="button"
                          class="session-menu-btn"
                          :disabled="sharedIsLoading"
                          aria-label="更多操作"
                          @click.stop="toggleSessionMenu(session.id)"
                        >
                          ⋮
                        </button>
                        <div
                          v-if="openSessionMenuId === session.id"
                          class="session-menu-dropdown"
                        >
                          <button
                            type="button"
                            class="session-menu-item"
                            @click="handleShareSession(session.id)"
                          >
                            分享
                          </button>
                          <button
                            type="button"
                            class="session-menu-item"
                            @click="handleRenameSession(session.id, session.title)"
                          >
                            重命名
                          </button>
                          <button
                            type="button"
                            class="session-menu-item danger"
                            :disabled="chatSessions.length <= 1"
                            @click="handleDeleteSession(session.id)"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </li>
                  </ul>
                </aside>

                <div
                  v-if="showSessionSidebar"
                  class="session-sidebar-backdrop"
                  @click="showSessionSidebar = false"
                />

                <div class="chat-main">
              <div class="chat-messages" ref="messagesContainer" @click.capture="handleArticleLinkClick">
                <div
                  v-for="(msg, index) in sharedMessages"
                  :key="index"
                  :class="['message', msg.role]"
                >
                  <div class="msg-bubble">
                    <div class="msg-body" v-html="formatMessage(msg.content)"></div>
                    <div
                      v-if="msg.role === 'assistant' && uniqueSources(msg.sources).length"
                      class="chat-refs"
                    >
                      <div class="chat-refs-label">参考</div>
                      <div class="chat-refs-list">
                        <a
                          v-for="s in uniqueSources(msg.sources)"
                          :key="s.path || s.id"
                          :href="sourceHref(s)"
                        >《{{ s.title }}》（{{ s.volume }}）</a>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="sharedIsLoading" class="message assistant">
                  <div class="msg-bubble thinking">教员思考中…</div>
                </div>

                <div v-if="sharedMessages.length === 1 && !sharedIsLoading" class="quick-start-grid">
                  <button
                    v-for="question in sampleQuestions"
                    :key="question"
                    class="quick-tag"
                    @click="useSampleQuestion(question)"
                  >
                    {{ question }}
                  </button>
                </div>
              </div>

              <div class="chat-input-area">
                <input
                  v-model="userInput"
                  @keyup.enter="sendMessage" @focus="focusChatInput"
                  placeholder="问问教员..."
                  :disabled="sharedIsLoading"
                  ref="chatInputRef"
                />
                <button
                  class="send-btn"
                  @click="sendMessage"
                  :disabled="sharedIsLoading || !userInput.trim()"
                >
                  <span v-if="sharedIsLoading" class="loading-dots">...</span>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    stroke="currentColor"
                    stroke-width="2"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
      <ChatDialog />
      <ChatSharePicker />
    </ClientOnly>
  </div>
</template>

<script setup>
import { nextTick, computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import { useData, useRouter } from 'vitepress'
import {
  WELCOME_TEXT,
  sharedMessages,
  sharedIsLoading,
  isModalOpen,
  openChat,
  closeChat,
  chatSessions,
  activeSessionId,
  createSession,
  switchSession,
  deleteSession,
  renameSession,
  getSessionMessages,
} from '../chat-state.mjs'
import { openSharePicker } from '../share-picker.mjs'
import {
  showChatAlert,
  showChatConfirm,
  showChatPrompt,
} from '../chat-dialog.mjs'
import ChatDialog from './ChatDialog.vue'
import ChatSharePicker from './ChatSharePicker.vue'
import { BaiduTrack } from '../baidu-tongji.mjs'

defineProps({ mode: { type: String, default: 'inline' } })
const { frontmatter } = useData()
const router = useRouter()
const isHome = computed(() => frontmatter.value.layout === 'home')

const userInput = ref('')
const messagesContainer = ref(null)
const chatInputRef = ref(null)
const chatModalWindow = ref(null)
const showSessionSidebar = ref(false)
const openSessionMenuId = ref(null)
let viewportCleanup = null

const toggleSessionSidebar = () => {
  showSessionSidebar.value = !showSessionSidebar.value
  if (!showSessionSidebar.value) {
    openSessionMenuId.value = null
  }
}

const closeSessionMenu = () => {
  openSessionMenuId.value = null
}

const toggleSessionMenu = (id) => {
  openSessionMenuId.value = openSessionMenuId.value === id ? null : id
}

const handleShareSession = async (sessionId) => {
  closeSessionMenu()
  const messages = getSessionMessages(sessionId)
  if (!openSharePicker(sessionId, messages, WELCOME_TEXT)) {
    await showChatAlert('该对话还没有可分享的内容，请先与教员交流。', '暂无法分享')
    return
  }
  showSessionSidebar.value = false
}

const handleNewSession = async () => {
  if (sharedIsLoading.value) return
  const result = createSession()
  if (result === 'empty_active') {
    await showChatAlert('当前已是新对话，请先提问后再开启新的对话。', '已是新对话')
    return
  }
  userInput.value = ''
  showSessionSidebar.value = false
  await nextTick()
  scrollToBottom()
  chatInputRef.value?.focus()
}

const handleSwitchSession = async (id) => {
  if (sharedIsLoading.value) return
  switchSession(id)
  userInput.value = ''
  showSessionSidebar.value = false
  await nextTick()
  scrollToBottom()
}

const handleDeleteSession = async (id) => {
  closeSessionMenu()
  if (sharedIsLoading.value || chatSessions.value.length <= 1) return
  const ok = await showChatConfirm('删除后无法恢复，确定删除这条对话吗？', '删除对话')
  if (!ok) return
  deleteSession(id)
  await nextTick()
  scrollToBottom()
}

const handleRenameSession = async (id, currentTitle) => {
  closeSessionMenu()
  if (sharedIsLoading.value) return
  const next = await showChatPrompt('重命名对话', currentTitle)
  if (next === null) return
  renameSession(id, next)
}

const sampleQuestions = [
  '请问教员如何看待当今之中国？',
  '最近感觉非常迷茫和内耗，该怎么办？',
  '如何看待现在的“毛选热”？',
  '《矛盾论》的精髓到底是什么？',
]

const openModal = async () => {
  openChat()
  BaiduTrack.chatOpen(isHome.value ? 'home' : 'article')
  scrollToBottom()
  await nextTick()
  bindVisualViewport()
}

function bindVisualViewport() {
  viewportCleanup?.()
  const vv = window.visualViewport
  const el = chatModalWindow.value
  if (!vv || !el) return

  const update = () => {
    const insetBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    el.style.setProperty('--vv-bottom-inset', `${insetBottom}px`)
  }
  update()
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  viewportCleanup = () => {
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
    el.style.removeProperty('--vv-bottom-inset')
  }
}

watch(isModalOpen, (open) => {
  if (open) {
    nextTick(() => bindVisualViewport())
  } else {
    viewportCleanup?.()
    viewportCleanup = null
  }
})

const onDocumentPointerDown = (e) => {
  if (!openSessionMenuId.value) return
  if (e.target.closest('.session-menu-wrap')) return
  closeSessionMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  viewportCleanup?.()
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

const focusChatInput = async () => {
  await nextTick()
  chatInputRef.value?.focus({ preventScroll: true })
  setTimeout(() => {
    chatInputRef.value?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, 320)
}

const closeModal = () => {
  showSessionSidebar.value = false
  closeSessionMenu()
  closeChat()
}

function onSparkDonateClick() {
  BaiduTrack.chatSparkLink()
  closeModal()
}

const useSampleQuestion = (question) => {
  userInput.value = question
  sendMessage()
}

const sendMessage = async () => {
  if (!userInput.value.trim() || sharedIsLoading.value) return

  const text = userInput.value
  sharedMessages.value.push({ role: 'user', content: text })
  userInput.value = ''
  sharedIsLoading.value = true
  scrollToBottom()

  try {
    const historyMessages = sharedMessages.value
      .filter((m) => m.content !== WELCOME_TEXT)
      .map((m) => ({ role: m.role, content: m.content }))

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyMessages }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || `请求失败 (${response.status})`)
    }
    const ragLabel = data.rag ? 'rag' : 'no_rag'
    BaiduTrack.chatSend(ragLabel)

    sharedMessages.value.push({
      role: 'assistant',
      content: data.reply || '（教员正在沉思）',
      sources: data.sources?.length ? uniqueSources(data.sources) : undefined,
    })
  } catch (err) {
    const hint = err?.message?.includes('请求失败') || err?.message?.includes('API')
      ? err.message
      : '网络似乎出了点问题，我们稍后再谈。'
    sharedMessages.value.push({
      role: 'assistant',
      content: hint,
    })
  } finally {
    sharedIsLoading.value = false
    scrollToBottom()
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function uniqueSources(sources) {
  if (!sources?.length) return []
  const seen = new Set()
  return sources.filter((s) => {
    const key = s.path || s.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sourceHref(s) {
  const p = s.path || ''
  return p.endsWith('.html') ? p : `${p}.html`
}

function normalizeArticlePath(href) {
  if (!href) return null
  let path = href
  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href)
      const host = url.hostname.replace(/^www\./, '')
      const siteHost = typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'xuemaoxuan.com'
      if (host !== siteHost && host !== 'xuemaoxuan.com') return null
      path = url.pathname
    }
  } catch {
    return null
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (!path.endsWith('.html') && !/\.[a-z0-9]+$/i.test(path)) path += '.html'
  return path
}

function handleArticleLinkClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor || !messagesContainer.value?.contains(anchor)) return
  const path = normalizeArticlePath(anchor.getAttribute('href'))
  if (!path) return
  event.preventDefault()
  closeModal()
  router.push(path)
}

function formatMessage(text) {
  const html = marked.parse(text || '')
  return html
    .replace(/href="https?:\/\/[^"]*?xuemaoxuan\.com([^"]+)"/gi, (_, p) => {
      let path = p
      if (!path.endsWith('.html') && !/\.[a-z0-9]+$/i.test(path)) path += '.html'
      return `href="${path}"`
    })
    .replace(/href="(\/[^"]+)"/g, (_, p) => {
      let path = p
      if (!path.endsWith('.html') && !/\.[a-z0-9]+$/i.test(path)) path += '.html'
      return `href="${path}"`
    })
}
</script>

<style scoped>
.chat-trigger-wrapper {
  position: relative;
  padding: 0 24px;
  margin: 0 auto 40px;
  box-sizing: border-box;
}
@media (min-width: 640px) {
  .chat-trigger-wrapper {
    padding: 0 48px;
  }
}
.chat-trigger-container {
  max-width: 1152px;
  margin: 0 auto;
  width: 100%;
}

.chat-trigger-card {
  background: var(--vp-c-bg);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}
.chat-trigger-card:hover {
  border-color: var(--vp-c-text-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.trigger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  font-size: 16px;
  color: var(--vp-c-text-1);
}
.trigger-header .icon {
  color: var(--vp-c-brand-1);
  font-size: 18px;
}
.trigger-fake-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--vp-c-text-3);
  font-size: 14px;
}
.send-icon {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.chat-float-wrapper {
  position: fixed;
  bottom: calc(30px + env(safe-area-inset-bottom, 0px));
  right: 30px;
  z-index: 9000;
}
.chat-float-wrapper.is-home {
  position: static;
  bottom: auto;
  right: auto;
  z-index: auto;
}
.chat-toggle-btn {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  padding: 12px 24px;
  border-radius: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.chat-toggle-btn:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.chat-modal-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  height: 100dvh;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}

.chat-modal-window {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 960px;
  height: 85vh;
  height: 85dvh;
  max-height: 85dvh;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  --vv-bottom-inset: 0px;
}

.chat-modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.session-sidebar {
  width: 176px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.sidebar-new-btn {
  margin: 8px;
  padding: 6px 10px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.sidebar-new-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1, #c82829);
  color: var(--vp-c-brand-1, #c82829);
}
.sidebar-new-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0 6px 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 2px;
  border-radius: 6px;
}
.session-item.active {
  background: var(--vp-c-bg);
}

.session-select-btn {
  flex: 1;
  min-width: 0;
  padding: 6px 6px 6px 8px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  color: var(--vp-c-text-1);
  border-radius: 6px;
}
.session-select-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.session-item.active .session-select-btn {
  color: var(--vp-c-brand-1, #c82829);
}

.session-title {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-menu-wrap {
  position: relative;
  flex-shrink: 0;
}

.session-menu-btn {
  width: 26px;
  height: 26px;
  margin-right: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.session-menu-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}
.session-menu-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.session-menu-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 2px);
  z-index: 20;
  min-width: 96px;
  padding: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}

.session-menu-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--vp-c-text-1);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.session-menu-item:hover:not(:disabled) {
  background: var(--vp-c-bg-soft);
}
.session-menu-item.danger {
  color: #c82829;
}
.session-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.session-sidebar-backdrop {
  display: none;
}

.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-toggle-btn,
.new-chat-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.2s ease, color 0.2s ease;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.new-chat-btn:hover:not(:disabled),
.history-toggle-btn:hover:not(:disabled),
.history-toggle-btn.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1, #c82829);
}
.new-chat-btn:disabled,
.history-toggle-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  -webkit-font-smoothing: antialiased;
}
.modal-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  font-size: 16px;
  color: var(--vp-c-text-1);
}
.modal-header-left .icon {
  color: var(--vp-c-brand-1);
  font-size: 18px;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.spark-link-btn,
.clear-text-btn,
.close-text-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.spark-link-btn {
  text-decoration: none;
}
.clear-text-btn:hover:not(:disabled),
.spark-link-btn:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1, #c82829);
}
.clear-text-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.close-text-btn:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  background: var(--vp-c-bg);
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
.chat-messages::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-thumb {
  background-color: var(--vp-c-divider);
  border-radius: 4px;
}

.message {
  margin-bottom: 24px;
  display: flex;
  width: 100%;
}
.message.user {
  justify-content: flex-end;
}
.message.assistant {
  justify-content: flex-start;
}

.msg-bubble {
  max-width: 85%;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}
.message.user .msg-bubble {
  background: var(--vp-c-bg-soft);
  border-bottom-right-radius: 2px;
}
.message.assistant .msg-bubble {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-bottom-left-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.message.assistant .msg-bubble.thinking {
  color: var(--vp-c-text-3);
  font-style: italic;
  border-style: dashed;
  animation: thinking-pulse 1.2s ease-in-out infinite;
}
@keyframes thinking-pulse {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}

.msg-bubble :deep(p) {
  margin: 0 0 10px 0;
}
.msg-bubble :deep(p:last-child) {
  margin-bottom: 0;
}
.msg-bubble :deep(h3) {
  margin: 16px 0 8px 0;
  font-size: 16px;
  font-weight: bold;
}
.msg-bubble :deep(ul) {
  padding-left: 20px;
}
.msg-body :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  border-bottom: 1px solid var(--vp-c-brand-1);
  font-weight: bold;
}
.chat-refs {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}
.chat-refs-label {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}
.chat-refs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chat-refs-list a {
  font-size: 13px;
  line-height: 1.45;
  color: var(--vp-c-text-3);
  font-weight: normal;
  text-decoration: none;
  border-bottom: none;
  transition: color 0.15s ease;
}
.chat-refs-list a:hover {
  color: var(--vp-c-brand-1);
}

.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}
.quick-tag {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  line-height: 1.4;
}
.quick-tag:hover {
  border-color: var(--vp-c-text-3);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.chat-input-area {
  display: flex;
  flex-shrink: 0;
  padding: 20px 24px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px));
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  gap: 16px;
}
.chat-input-area input {
  flex: 1;
  padding: 14px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 30px;
  outline: none;
  font-size: 16px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  transition: all 0.2s ease;
}
.chat-input-area input::placeholder {
  color: var(--vp-c-text-3);
}
.chat-input-area input:focus {
  border-color: var(--vp-c-text-3);
  background: var(--vp-c-bg);
}
.send-btn {
  padding: 0 24px;
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  border: none;
  border-radius: 30px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) {
  opacity: 0.88;
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.25s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}

@media (max-width: 640px) {
  .chat-trigger-wrapper {
    padding: 0 24px;
  }
  .chat-float-wrapper:not(.is-home) {
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    right: 16px;
  }

  .session-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 2;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  }

  .session-sidebar-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 1;
    background: rgba(0, 0, 0, 0.35);
  }

  .chat-modal-overlay {
    align-items: stretch;
  }

  .chat-modal-window {
    height: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    max-width: 100%;
  }

  .modal-header {
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
    padding-left: 16px;
    padding-right: 16px;
  }

  .chat-messages {
    padding: 16px;
  }

  .quick-start-grid {
    grid-template-columns: 1fr;
  }
  .chat-input-area {
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px));
    gap: 10px;
  }
  .send-btn {
    padding: 0 16px;
  }
}
</style>
