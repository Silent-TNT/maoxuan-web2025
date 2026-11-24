<template>
  <div v-if="mode === 'inline' && isHome" class="chat-trigger-wrapper">
    <div class="chat-trigger-container">
      <div class="chat-trigger-card" @click="openModal">
        <div class="trigger-header">
          <span class="icon">★</span>
          <span class="title">教员咨询室</span>
        </div>
        <div class="trigger-fake-input">
          <span class="placeholder">从原文出发，把问题谈明白</span>
          <div class="send-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="mode === 'float'" class="chat-float-wrapper">
    <button class="chat-toggle-btn" :class="{ 'is-article': isArticlePage }" @click="openModal">
      ★ 教员咨询室
    </button>

    <ClientOnly>
      <Teleport to="body">
        <Transition name="fade-scale">
          <div v-if="isModalOpen" class="chat-modal-overlay">
            <div class="chat-modal-backdrop" @click.self="closeModal" />
            <div
              ref="chatModalWindow"
              class="chat-modal-window"
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-modal-title"
              tabindex="-1"
            >
              <div class="modal-header">
                <div class="modal-header-left">
                  <span class="icon">★</span>
                  <span id="chat-modal-title" class="title">教员咨询室</span>
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
                  <button
                    type="button"
                    class="sidebar-clear-all-btn"
                    :disabled="sharedIsLoading"
                    @click="handleClearAllSessions"
                  >
                    清空全部历史
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
              <div
                v-if="articleSwitchNotice"
                class="article-switch-banner"
                role="status"
              >
                <div class="article-switch-copy">
                  <strong>已进入《{{ articleSwitchNotice.toTitle }}》</strong>
                  <span v-if="articleSwitchNotice.fromTitle">
                    当前对话主要来自《{{ articleSwitchNotice.fromTitle }}》，要继续原对话，还是另开本文咨询？
                  </span>
                  <span v-else>当前对话来自另一篇文章，要继续原对话，还是另开本文咨询？</span>
                </div>
                <div class="article-switch-actions">
                  <button type="button" @click="continuePreviousConversation">继续原对话</button>
                  <button type="button" class="primary" @click="startCurrentArticleConversation">开始本文咨询</button>
                </div>
              </div>
              <div
                class="chat-messages"
                ref="messagesContainer"
                :aria-live="sharedIsLoading ? 'off' : 'polite'"
                :aria-busy="sharedIsLoading"
                @scroll.passive="updateScrollFollowing"
                @click.capture="handleArticleLinkClick"
              >
                <div
                  v-for="(msg, index) in visibleMessages"
                  :key="index"
                  v-memo="[msg, msg.content, msg.waitingMessage, isNewConversation && welcomeCopy, index === activeReply?.index, index === sharedMessages.length - 1, sharedIsLoading && (index === sharedMessages.length - 1 || !!msg.retryText)]"
                  :class="['message', msg.role, { 'welcome-arrival': isNewConversation, 'has-reply-status': msg.retryText }]"
                >
                  <div v-if="msg.content || index === activeReply?.index" class="msg-bubble" :class="{ thinking: !msg.content }">
                    <div v-if="msg.role === 'user' && msg.articleTitle" class="message-article-context">
                      来自《{{ cleanArticleTitle(msg.articleTitle) }}》
                    </div>
                    <blockquote v-if="msg.role === 'user' && msg.selectedText" class="message-selection-quote">
                      {{ compactText(msg.selectedText, 96) }}
                    </blockquote>
                    <div
                      v-if="msg.content"
                      class="msg-body"
                      :class="{ 'is-writing': index === activeReply?.index }"
                      v-html="formatMessage(msg)"
                    ></div>
                    <span v-else>{{ activeReply.waitingMessage }}</span>
                    <details
                      v-if="msg.role === 'assistant' && uniqueSources(msg.sources).length"
                      class="chat-evidence"
                    >
                      <summary class="chat-evidence-summary">翻到的原文 · {{ uniqueSources(msg.sources).length }} 处</summary>
                      <div class="chat-evidence-list">
                        <article
                          v-for="(s, sourceIndex) in uniqueSources(msg.sources)"
                          :key="`${s.sourceNumber || sourceIndex + 1}:${s.id || s.path || s.title}`"
                          :data-evidence-number="s.sourceNumber || sourceIndex + 1"
                          class="evidence-card"
                          tabindex="-1"
                        >
                          <span class="evidence-number">【{{ s.sourceNumber || sourceIndex + 1 }}】</span>
                          <blockquote v-if="s.evidenceText || s.text">{{ s.evidenceText || s.text }}</blockquote>
                          <details v-if="s.contextText" class="evidence-context">
                            <summary>展开上下文</summary>
                            <blockquote>{{ s.contextText }}</blockquote>
                          </details>
                          <a :href="sourceHref(s)">查看《{{ s.title }}》（{{ s.volume }}）全文</a>
                        </article>
                      </div>
                    </details>
                    <button
                      v-if="showFollowUp(msg, index)"
                      type="button"
                      class="follow-up-btn"
                      @click="sendMessage(msg.suggestions[0])"
                    >{{ msg.suggestions[0] }}</button>
                  </div>
                  <div v-if="msg.retryText" class="reply-status">
                    <span v-if="msg.replyStatus">{{ msg.replyStatus }}</span>
                    <button type="button" class="retry-btn" :disabled="sharedIsLoading" @click="sendMessage(msg.retryText, index)">
                      接着刚才说
                    </button>
                  </div>
                </div>

                <details v-if="isNewConversation && showWelcomeBubble && !sharedIsLoading" class="quick-start-area">
                  <summary>看看怎么问</summary>
                  <div class="quick-start-list">
                    <button
                      v-for="question in sampleQuestions"
                      :key="question"
                      type="button"
                      class="quick-tag"
                      @click="sendMessage(question)"
                    >{{ question }}</button>
                  </div>
                </details>
              </div>

              <div v-if="!followLatest" class="latest-reply-control">
                <button type="button" class="latest-reply-btn" @click="scrollToBottom(true)">
                  回到最新消息 ↓
                </button>
              </div>

              <div v-if="readingContextTitle" class="reading-context-bar">
                <div class="reading-context-main">
                  <div class="reading-context-copy">
                    <span>当前阅读：《{{ readingContextTitle }}》</span>
                    <span v-if="lastArticleSelection" class="selection-count">
                      {{ lastArticleSelection.length }} 字 · 仅随这条发送
                    </span>
                  </div>
                  <div v-if="lastArticleSelection" class="selection-preview" :title="lastArticleSelection">
                    “{{ selectionPreview }}”
                  </div>
                </div>
                <div class="reading-context-actions">
                  <button
                    v-if="lastArticleSelection"
                    type="button"
                    :disabled="sharedIsLoading"
                    @click="explainSelection"
                  >解释这段</button>
                  <button
                    v-if="lastArticleSelection"
                    type="button"
                    aria-label="清除选中的原文"
                    @click="clearReadingSelection"
                  >×</button>
                </div>
              </div>

              <div class="chat-input-area">
                <textarea
                  v-model="userInput"
                  rows="1"
                  @keydown.enter="handleComposerEnter"
                  :placeholder="composerPlaceholder"
                  aria-label="输入消息"
                  ref="chatInputRef"
                ></textarea>
                <button
                  type="button"
                  class="send-btn"
                  :class="{ 'is-stop': sharedIsLoading }"
                  :aria-label="sharedIsLoading ? '停止回答' : '发送消息'"
                  @mousedown.prevent
                  @click="sharedIsLoading ? stopGeneration() : submitMessage()"
                  :disabled="!sharedIsLoading && !userInput.trim()"
                >
                  <span v-if="sharedIsLoading" class="stop-label">停止</span>
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
              <div class="chat-privacy-note">这是 AI 模拟的教员，不是本人。对话只存在本机，提问会发送到 AI 服务。</div>
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
import { marked, Renderer } from 'marked'
import { useData, useRouter } from 'vitepress'
import {
  WELCOME_TEXT,
  articleExplanationRequest,
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
  clearAllSessions,
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

const props = defineProps({ mode: { type: String, default: 'inline' } })
const { frontmatter, page } = useData()
const router = useRouter()
const isHome = computed(() => frontmatter.value.layout === 'home')
const isArticlePage = computed(() => /^第[一二三四]卷\/\d{3}-.+\.md$/u.test(page.value?.relativePath || ''))

const userInput = ref('')
const messagesContainer = ref(null)
const chatInputRef = ref(null)
const chatModalWindow = ref(null)
const activeReply = ref(null)
const followLatest = ref(true)
const showSessionSidebar = ref(false)
const openSessionMenuId = ref(null)
const lastArticleSelection = ref('')
const articleSwitchNotice = ref(null)
const dismissedSwitchPath = ref('')
const showWelcomeBubble = ref(false)
const isNewConversation = computed(() =>
  sharedMessages.value.length === 1 &&
  sharedMessages.value[0]?.role === 'assistant' &&
  sharedMessages.value[0]?.content === WELCOME_TEXT,
)
const visibleMessages = computed(() => {
  if (isNewConversation.value && !showWelcomeBubble.value) return []
  if (!activeReply.value) return sharedMessages.value
  const messages = sharedMessages.value.slice()
  messages[activeReply.value.index] = activeReply.value
  return messages
})
let previousArticleLocation = null
const selectionPreview = computed(() => compactText(lastArticleSelection.value, 92))
const readingContextTitle = computed(() => {
  if (!isArticlePage.value) return ''
  const title = page.value?.title || ''
  return title
    .replace(/全文.*$/u, '')
    .replace(/\s*[|｜-]\s*毛泽东选集.*$/u, '')
    .trim()
})
const welcomeCopy = computed(() => {
  if (!readingContextTitle.value) return WELCOME_TEXT
  if (lastArticleSelection.value) return '你圈的这一段，我们从这儿谈。'
  return `你刚在读《${readingContextTitle.value}》。哪一句想停下来谈谈？`
})
const composerPlaceholder = computed(() => {
  if (lastArticleSelection.value) return '教员，我读到这儿，想问问…'
  if (sharedIsLoading.value) return '教员，我还想补一句…'
  const last = sharedMessages.value.at(-1)
  if (last?.awaitingReply && !last.retryText) return '教员，事情是这样的…'
  if (readingContextTitle.value && isNewConversation.value) return '教员，这篇我读到一处…'
  return isNewConversation.value ? '教员，我想跟您说件事…' : '教员，我接着说…'
})
let viewportCleanup = null
let activeAbortController = null
let requestTimeoutId = null
let stopRequested = false
let timeoutTriggered = false
let quoteHighlightTimer = null
let pendingSourceQuote = ''
let modalTrigger = null

const CHAT_SCROLL_LOCK_ATTR = 'data-maoxuan-chat-scroll-lock'
const CHAT_PREVIOUS_OVERFLOW_ATTR = 'data-maoxuan-chat-previous-overflow'

function lockPageScroll() {
  const body = document.body
  if (body.hasAttribute(CHAT_SCROLL_LOCK_ATTR)) return
  body.setAttribute(CHAT_SCROLL_LOCK_ATTR, '')
  body.setAttribute(CHAT_PREVIOUS_OVERFLOW_ATTR, body.style.overflow || '')
  body.style.overflow = 'hidden'
}

function unlockPageScroll() {
  const body = document.body
  if (!body.hasAttribute(CHAT_SCROLL_LOCK_ATTR)) return
  body.style.overflow = body.getAttribute(CHAT_PREVIOUS_OVERFLOW_ATTR) || ''
  body.removeAttribute(CHAT_SCROLL_LOCK_ATTR)
  body.removeAttribute(CHAT_PREVIOUS_OVERFLOW_ATTR)
}

function cancelQuotedSourceHighlight() {
  if (quoteHighlightTimer !== null) window.clearTimeout(quoteHighlightTimer)
  quoteHighlightTimer = null
}

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
  articleSwitchNotice.value = null
  await nextTick()
  scrollToBottom(true)
  focusOnOpen()
}

const handleSwitchSession = async (id) => {
  if (sharedIsLoading.value) return
  switchSession(id)
  userInput.value = ''
  showSessionSidebar.value = false
  await nextTick()
  refreshArticleSwitchNotice()
  scrollToBottom(true)
}

const handleDeleteSession = async (id) => {
  closeSessionMenu()
  if (sharedIsLoading.value || chatSessions.value.length <= 1) return
  const ok = await showChatConfirm('删除后无法恢复，确定删除这条对话吗？', '删除对话')
  if (!ok) return
  deleteSession(id)
  await nextTick()
  scrollToBottom(true)
}

const handleClearAllSessions = async () => {
  if (sharedIsLoading.value) return
  const ok = await showChatConfirm('这会删除本机保存的全部历史对话，且无法恢复。确定清空吗？', '清空全部历史')
  if (!ok) return
  clearAllSessions()
  showSessionSidebar.value = false
  userInput.value = ''
  await nextTick()
  scrollToBottom(true)
}

const handleRenameSession = async (id, currentTitle) => {
  closeSessionMenu()
  if (sharedIsLoading.value) return
  const next = await showChatPrompt('重命名对话', currentTitle)
  if (next === null) return
  renameSession(id, next)
}

const sampleQuestions = [
  '手头事情很多，怎么抓住重点？',
  '为什么《实践论》说认识要回到实践中检验？',
  '主要矛盾和矛盾的主要方面，有什么区别？',
]

const openModal = () => {
  openChat()
  BaiduTrack.chatOpen(isHome.value ? 'home' : 'article')
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

function prepareOpenModal() {
  modalTrigger = document.activeElement
  refreshArticleSwitchNotice()
  lockPageScroll()
  scrollToBottom(true)
  nextTick(() => {
    if (!isModalOpen.value) return
    bindVisualViewport()
    focusOnOpen()
  })
}

function usesTouchComposer() {
  return window.matchMedia('(max-width: 640px), (pointer: coarse)').matches
}

function focusOnOpen() {
  const target = usesTouchComposer() ? chatModalWindow.value : chatInputRef.value
  target?.focus({ preventScroll: true })
}

function resizeChatInput() {
  const input = chatInputRef.value
  if (!input) return
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`
  scrollToBottom()
}

watch([isModalOpen, userInput], resizeChatInput, { flush: 'post' })

watch(isModalOpen, (open) => {
  if (open) {
    prepareOpenModal()
  } else {
    unlockPageScroll()
    viewportCleanup?.()
    viewportCleanup = null
    if (modalTrigger instanceof HTMLElement && modalTrigger.isConnected) {
      modalTrigger.focus({ preventScroll: true })
    }
    modalTrigger = null
  }
})

watch([isModalOpen, activeSessionId], ([open], _previous, onCleanup) => {
  if (props.mode !== 'float') return
  showWelcomeBubble.value = false
  if (!open || !isNewConversation.value) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    showWelcomeBubble.value = true
    return
  }
  const timer = window.setTimeout(() => { showWelcomeBubble.value = true }, 320)
  onCleanup(() => window.clearTimeout(timer))
}, { immediate: true })

watch(() => page.value?.relativePath, async () => {
  if (!isModalOpen.value) unlockPageScroll()
  cancelQuotedSourceHighlight()
  lastArticleSelection.value = ''
  await nextTick()
  const current = currentArticleLocation()
  if (
    previousArticleLocation?.path &&
    current?.path &&
    previousArticleLocation.path !== current.path &&
    hasUserConversation()
  ) {
    const conversationContext = conversationArticleContext()
    articleSwitchNotice.value = {
      fromTitle: conversationContext?.title || previousArticleLocation.title,
      fromPath: conversationContext?.path || previousArticleLocation.path,
      toTitle: current.title,
      toPath: current.path,
    }
    dismissedSwitchPath.value = ''
  }
  previousArticleLocation = current
})

const onDocumentPointerDown = (e) => {
  if (!openSessionMenuId.value) return
  if (e.target.closest('.session-menu-wrap')) return
  closeSessionMenu()
}

const onDocumentKeydown = (event) => {
  if (!isModalOpen.value || document.querySelector('.chat-dialog-overlay')) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeModal()
    return
  }
  if (event.key !== 'Tab' || !chatModalWindow.value) return
  const focusable = [...chatModalWindow.value.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === chatModalWindow.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  if (props.mode !== 'float') return
  previousArticleLocation = currentArticleLocation()
  if (isModalOpen.value) prepareOpenModal()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('selectionchange', rememberArticleSelection)
  document.addEventListener('mouseup', rememberArticleSelection)
  window.addEventListener('resize', resizeChatInput)
  nextTick(scheduleQuotedSourceHighlight)
})

onUnmounted(() => {
  if (props.mode !== 'float') return
  unlockPageScroll()
  cancelQuotedSourceHighlight()
  viewportCleanup?.()
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('selectionchange', rememberArticleSelection)
  document.removeEventListener('mouseup', rememberArticleSelection)
  window.removeEventListener('resize', resizeChatInput)
})

function rememberArticleSelection() {
  if (!isArticlePage.value) {
    lastArticleSelection.value = ''
    return
  }
  const selection = window.getSelection()
  const text = selection?.toString().trim()
  if (!text || text.length < 2) return
  const range = selection.rangeCount ? selection.getRangeAt(0) : null
  const startElement = range?.startContainer?.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range?.startContainer?.parentElement
  const endElement = range?.endContainer?.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range?.endContainer?.parentElement
  const article = startElement?.closest('.vp-doc')
  lastArticleSelection.value = article && article === endElement?.closest('.vp-doc') ? text.slice(0, 1600) : ''
}

function currentReadingContext() {
  if (!isArticlePage.value) return null
  return {
    title: readingContextTitle.value || page.value?.title || '',
    path: window.location.pathname,
    selectedText: lastArticleSelection.value,
  }
}

function compactText(value, maxLength = 96) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function cleanArticleTitle(value) {
  return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

function currentArticleLocation() {
  if (!isArticlePage.value) return null
  return {
    title: readingContextTitle.value || page.value?.title || '',
    path: window.location.pathname,
  }
}

function hasUserConversation() {
  return sharedMessages.value.some((message) => message.role === 'user' && message.content?.trim())
}

function conversationArticleContext() {
  for (let index = sharedMessages.value.length - 1; index >= 0; index -= 1) {
    const message = sharedMessages.value[index]
    if (message.role === 'user' && message.articlePath) {
      return { title: cleanArticleTitle(message.articleTitle), path: message.articlePath }
    }
  }
  return null
}

function refreshArticleSwitchNotice() {
  const current = currentArticleLocation()
  const conversationContext = conversationArticleContext()
  if (!current || !conversationContext || current.path === conversationContext.path) {
    if (!articleSwitchNotice.value || articleSwitchNotice.value?.toPath !== current?.path) {
      articleSwitchNotice.value = null
    }
    return
  }
  if (dismissedSwitchPath.value === current.path) return
  articleSwitchNotice.value = {
    fromTitle: conversationContext.title,
    fromPath: conversationContext.path,
    toTitle: current.title,
    toPath: current.path,
  }
}

function continuePreviousConversation() {
  dismissedSwitchPath.value = articleSwitchNotice.value?.toPath || ''
  articleSwitchNotice.value = null
  nextTick(focusOnOpen)
}

async function startCurrentArticleConversation() {
  if (sharedIsLoading.value) return
  createSession()
  articleSwitchNotice.value = null
  dismissedSwitchPath.value = ''
  userInput.value = ''
  await nextTick()
  scrollToBottom(true)
  focusOnOpen()
}

function clearReadingSelection() {
  lastArticleSelection.value = ''
  window.getSelection()?.removeAllRanges()
}

function explainSelection() {
  if (!lastArticleSelection.value || sharedIsLoading.value) return
  sendMessage('教员，我读到这儿，想请您讲讲这段。')
}

const closeModal = () => {
  showSessionSidebar.value = false
  closeSessionMenu()
  closeChat()
  // 跳转文章时不能只等异步 watch 清理，否则新页面可能短暂继承滚动锁。
  unlockPageScroll()
}

function onSparkDonateClick() {
  BaiduTrack.chatSparkLink()
  closeModal()
}

function showFollowUp(message, index) {
  if (sharedIsLoading.value || index !== sharedMessages.value.length - 1 || !message.suggestions?.[0]) return false
  if (message.role !== 'assistant' || !message.content || message.content === WELCOME_TEXT || message.retryText) return false
  const awaitingReply = message.awaitingReply ?? /[？?](?:\s|\[\d+\]|[”’」』）)])*$/u.test(message.content)
  return !awaitingReply
}

const submitMessage = () => {
  if (sharedIsLoading.value) return
  const text = userInput.value
  if (!text.trim()) return
  userInput.value = ''
  sendMessage(text)
}

function handleComposerEnter(event) {
  if (event.isComposing || event.keyCode === 229 || event.repeat) return
  // 触屏设备回车换行，Ctrl/⌘+Enter 发送；桌面回车直接发
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    submitMessage()
    return
  }
  if (event.shiftKey || event.altKey || usesTouchComposer()) return
  event.preventDefault()
  submitMessage()
}

const stopGeneration = () => {
  if (!sharedIsLoading.value || !activeAbortController) return
  stopRequested = true
  activeAbortController.abort()
}

async function readNdjsonStream(response) {
  if (!response.body) throw new Error('回答服务没有返回可读取的内容')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload = null

  let pendingText = ''
  let frame = null
  const flush = () => {
    frame = null
    if (activeReply.value && pendingText) {
      activeReply.value.content += pendingText
      pendingText = ''
      scrollToBottom()
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'delta' && event.delta) {
          pendingText += event.delta
          if (frame === null) frame = window.requestAnimationFrame(flush)
        } else if (event.type === 'done') {
          donePayload = event
        } else if (event.type === 'error') {
          throw new Error(event.error || '回答服务发生错误')
        }
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
    if (frame !== null) window.cancelAnimationFrame(frame)
    flush()
  }
  if (!donePayload) throw new Error('回答流意外中断')
  return donePayload
}

const sendMessage = async (inputText, retryIndex = null) => {
  const text = typeof inputText === 'string' ? inputText.trim() : ''
  if (!text || sharedIsLoading.value) return
  const retrying = retryIndex !== null
  const previousReply = retrying ? sharedMessages.value[retryIndex] : null
  const previousQuestion = retrying
    ? sharedMessages.value.slice(0, retryIndex).findLast((message) => message.role === 'user')
    : null
  const readingContext = retrying
    ? previousQuestion?.articlePath
      ? { title: previousQuestion.articleTitle, path: previousQuestion.articlePath, selectedText: previousQuestion.selectedText }
      : null
    : currentReadingContext()

  if (!retrying) {
    if (isNewConversation.value && welcomeCopy.value !== WELCOME_TEXT) {
      sharedMessages.value[0].welcomeCopy = welcomeCopy.value
    }
    sharedMessages.value.push({
      role: 'user',
      content: text,
      articleTitle: readingContext?.title || undefined,
      articlePath: readingContext?.path || undefined,
      selectedText: readingContext?.selectedText || undefined,
    })
    if (readingContext?.selectedText) clearReadingSelection()
  }
  const replyIndex = retryIndex ?? sharedMessages.value.length
  sharedIsLoading.value = true
  activeReply.value = {
    index: replyIndex,
    role: 'assistant',
    content: '',
    waitingMessage: readingContext?.selectedText ? '（低头翻了翻书）' : '莫急，我想一想。',
  }
  stopRequested = false
  timeoutTriggered = false
  activeAbortController = new AbortController()
  const waitingHintId = window.setTimeout(() => {
    if (activeReply.value && !activeReply.value.content) {
      activeReply.value.waitingMessage = readingContext?.selectedText ? '（指尖停在你圈出的那一句）' : '这事得想仔细些，你稍坐。'
    }
  }, 1200)
  requestTimeoutId = window.setTimeout(() => {
    timeoutTriggered = true
    activeAbortController?.abort()
  }, 60000)
  scrollToBottom(!retrying)

  try {
    const historyMessages = sharedMessages.value
      .slice(0, replyIndex)
      .filter((m) => m.content && m.content !== WELCOME_TEXT && !m.retryText)
      .map((m) => ({ role: m.role, content: m.content }))
    if (retrying && !previousQuestion) historyMessages.push({ role: 'user', content: text })

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: historyMessages,
        readingContext,
        interruptedReply: previousReply?.content || undefined,
        stream: true,
      }),
      signal: activeAbortController.signal,
    })

    if (!response.ok) {
      let error = `请求失败 (${response.status})`
      try {
        const data = await response.json()
        error = data.error || error
      } catch {
        /* keep status error */
      }
      throw new Error(error)
    }

    const data = await readNdjsonStream(response)
    const content = data.reply?.trim() || activeReply.value.content.trim()
    if (!content) throw new Error('回答内容为空')
    const ragLabel = data.rag ? 'rag' : 'no_rag'
    BaiduTrack.chatSend(ragLabel)

    sharedMessages.value[replyIndex] = {
      role: 'assistant',
      content,
      sources: data.sources?.length ? uniqueSources(data.sources) : undefined,
      suggestions: data.suggestions?.length ? data.suggestions.slice(0, 1) : undefined,
      awaitingReply: data.awaitingReply,
      retrievalStatus: data.retrievalStatus,
    }
  } catch (err) {
    const partial = activeReply.value.content.trim() || (previousReply?.replyStatus ? previousReply.content : '')
    let replyStatus = partial ? '刚才的话断在这儿了。我接着说。' : '刚才那句话我没接上。你稍坐，我再说。'
    if (timeoutTriggered) replyStatus = '让你等久了。我们接着刚才那句。'
    else if (stopRequested) replyStatus = '好，先停在这儿。你有话，先说。'
    else if (/歇口气|问的人多/u.test(String(err?.message || ''))) replyStatus = '这会儿问我的人多，我先歇口气，过一会儿再说。'
    sharedMessages.value[replyIndex] = {
      role: 'assistant',
      content: partial,
      replyStatus,
      retryText: text,
    }
  } finally {
    window.clearTimeout(waitingHintId)
    if (requestTimeoutId) window.clearTimeout(requestTimeoutId)
    requestTimeoutId = null
    activeAbortController = null
    sharedIsLoading.value = false
    activeReply.value = null
    scrollToBottom()
  }
}

function updateScrollFollowing() {
  const messages = messagesContainer.value
  if (!messages) return
  followLatest.value = messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 32
}

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (messagesContainer.value && (force || followLatest.value)) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    followLatest.value = true
  }
}

function uniqueSources(sources) {
  if (!sources?.length) return []
  const seen = new Set()
  return sources.filter((s) => {
    // 同一篇文章可以有多个独立检索片段，编号不同就应分别展示。
    const key = s.sourceNumber
      ? `number:${s.sourceNumber}`
      : `source:${s.id || ''}:${s.path || s.title}:${s.evidenceText || s.text || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sourceHref(s) {
  const p = s.path || ''
  const articlePath = p.endsWith('.html') ? p : `${p}.html`
  const quote = (s.evidenceText || '').replace(/\s+/g, ' ').trim().slice(0, 160)
  return quote ? `${articlePath}?quote=${encodeURIComponent(quote)}` : articlePath
}

function normalizeArticlePath(href) {
  if (!href) return null
  try {
    const url = new URL(href, window.location.origin)
    const host = url.hostname.replace(/^www\./, '')
    const siteHost = window.location.hostname.replace(/^www\./, '')
    if (host !== siteHost && host !== 'xuemaoxuan.com') return null
    let path = url.pathname
    if (!path.startsWith('/') || path.startsWith('//')) return null
    if (!path.endsWith('.html') && !/\.[a-z0-9]+$/i.test(path)) path += '.html'
    return `${path}${url.search}${url.hash}`
  } catch {
    return null
  }
}

const QUOTE_HIGHLIGHT_WINDOW_MS = 8000

function currentSourceQuote() {
  // 内存里存的是证据全文，优先用它；URL 上的 quote 只是为了分享/整页跳转，可能被截断
  if (pendingSourceQuote) return pendingSourceQuote.replace(/\s+/gu, ' ').replace(/^>\s*/u, '').trim()
  const fromUrl = new URLSearchParams(window.location.search).get('quote')
  return (fromUrl || '').replace(/\s+/gu, ' ').replace(/^>\s*/u, '').trim()
}

function clearQuotedSourceHighlight() {
  document.querySelectorAll('.maoxuan-source-highlight').forEach((element) => {
    if (element.tagName !== 'MARK') {
      element.classList.remove('maoxuan-source-highlight')
      return
    }
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) parent.insertBefore(element.firstChild, element)
    parent.removeChild(element)
    parent.normalize()
  })
}

/**
 * 正文一个段落可能是几千字的长块（单换行被渲染成 <br>），
 * 所以按文本节点里的字符区间把那句话精确括出来，而不是给整段加类名。
 */
function markQuoteInArticle(container, quote) {
  const wanted = quote.replace(/\s+/gu, '')
  if (wanted.length < 4) return false
  const needles = [...new Set([wanted, wanted.slice(0, 48), wanted.slice(0, 32), wanted.slice(0, 20)])]
    .filter((needle) => needle.length >= 8)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  let node
  while ((node = walker.nextNode())) if (node.nodeValue?.trim()) nodes.push(node)
  for (const needle of needles) {
    for (const textNode of nodes) {
      const raw = textNode.nodeValue || ''
      const positions = []
      for (let i = 0; i < raw.length; i++) if (!/\s/u.test(raw[i])) positions.push(i)
      const compact = positions.map((position) => raw[position]).join('')
      const at = compact.indexOf(needle)
      if (at < 0) continue
      const start = positions[at]
      let end = positions[at + needle.length - 1] + 1
      // 分享链接/降级匹配时拿到的可能只是句子前半截，把高亮补到句末标点
      const maxEnd = Math.min(raw.length, end + 200)
      while (end < maxEnd && !/[。！？…]/u.test(raw[end - 1])) end++
      if (end < maxEnd && /[。！？…]/u.test(raw[end - 1])) {
        while (end < raw.length && /[”」』）】]/u.test(raw[end])) end++
      }
      clearQuotedSourceHighlight()
      const mark = document.createElement('mark')
      mark.className = 'maoxuan-source-highlight'
      try {
        const range = document.createRange()
        range.setStart(textNode, start)
        range.setEnd(textNode, end)
        // 把原文取出来放回 mark 里；只 insertNode 空节点会让这句话从页面上消失
        mark.appendChild(range.extractContents())
        range.insertNode(mark)
      } catch {
        continue
      }
      if (!mark.isConnected) continue
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
  }
  // 跨文本节点（比如中间夹了 <br> 或强调标签）时，退回最小可容纳该句的块级元素
  for (const needle of needles) {
    const blocks = [...container.querySelectorAll('p, blockquote, li')]
      .filter((element) => (element.textContent || '').replace(/\s+/gu, '').includes(needle))
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
    const target = blocks[0]
    if (!target) continue
    clearQuotedSourceHighlight()
    target.classList.add('maoxuan-source-highlight')
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  return false
}

function highlightQuotedSource() {
  const quote = currentSourceQuote()
  if (!quote) return true
  const container = document.querySelector('.vp-doc') || document.querySelector('.content-body') ||
    document.querySelector('main')
  if (!container) return false
  return markQuoteInArticle(container, quote)
}

function scheduleQuotedSourceHighlight() {
  cancelQuotedSourceHighlight()
  const deadline = Date.now() + QUOTE_HIGHLIGHT_WINDOW_MS
  const tryHighlight = () => {
    quoteHighlightTimer = null
    if (!currentSourceQuote()) return
    if (highlightQuotedSource()) {
      pendingSourceQuote = ''
      return
    }
    if (Date.now() >= deadline) return
    quoteHighlightTimer = window.setTimeout(tryHighlight, 250)
  }
  tryHighlight()
}

async function handleArticleLinkClick(event) {
  const reference = event.target.closest('button[data-source-number]')
  if (reference) {
    const number = reference.dataset.sourceNumber
    const card = reference.closest('.message')?.querySelector(`[data-evidence-number="${number}"]`)
    if (!card) return
    card.closest('details.chat-evidence').open = true
    card.focus({ preventScroll: true })
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  const anchor = event.target.closest('a')
  if (!anchor || !messagesContainer.value?.contains(anchor)) return
  const path = normalizeArticlePath(anchor.getAttribute('href'))
  if (!path) return
  const card = anchor.closest('.evidence-card')
  pendingSourceQuote = card?.querySelector('blockquote')?.textContent?.trim() || ''
  event.preventDefault()
  closeModal()
  await nextTick()
  try {
    await router.go(path)
  } catch {
    // 极端情况下（路由异常）退回整页跳转；届时靠 URL 上的 quote 参数在载入后高亮
    window.location.assign(path)
    return
  }
  scheduleQuotedSourceHighlight()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeChatHref(href) {
  const value = String(href || '').trim()
  if (value.startsWith('/') && !value.startsWith('//')) return value
  if (value.startsWith('#')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

const chatRenderer = new Renderer()
chatRenderer.html = ({ text }) => escapeHtml(text)
chatRenderer.image = ({ text }) => `<span class="blocked-image">【图片：${escapeHtml(text)}】</span>`
chatRenderer.link = function ({ href, title, tokens }) {
  this.renderingLinkLabel = true
  let label
  try {
    label = this.parser.parseInline(tokens)
  } finally {
    this.renderingLinkLabel = false
  }
  const safeHref = safeChatHref(href)
  if (!safeHref) return label
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${label}</a>`
}

function formatMessage(message) {
  let text = message.content || ''
  let stageDirection = ''
  if (message.role === 'assistant') {
    if (text === WELCOME_TEXT) text = isNewConversation.value ? welcomeCopy.value : message.welcomeCopy || text
    // The model's sentence IDs are replaced by public citation numbers in the final event.
    text = text.replace(/\[\d+\.\d+\]|【\d+\.\d+】|(?:\[|【)\d+\.\d*$/gu, '')
    const openingAction = text.match(/^\s*(（(?!\d|第[一二三四五六七八九十])[^（）\r\n]{4,50}）)\s*/u)
    if (openingAction) {
      stageDirection = `<p class="stage-direction">${escapeHtml(openingAction[1])}</p>`
      text = text.slice(openingAction[0].length)
    }
  }

  const sourceNumbers = new Set(uniqueSources(message.sources).map((source, index) => source.sourceNumber || index + 1))
  const renderer = Object.create(chatRenderer)
  renderer.text = function (token) {
    const html = chatRenderer.text.call(this, token)
    if (token.tokens || this.renderingLinkLabel) return html
    return html.replace(/\[(\d+)\]/g, (marker, number) =>
      sourceNumbers.has(Number(number))
        ? `<button type="button" class="inline-source-ref" data-source-number="${number}" aria-label="查看原文依据 ${number}">【${number}】</button>`
        : marker,
    )
  }
  const html = stageDirection + marked.parse(text, { renderer, breaks: message.role === 'user' })
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
watch(articleExplanationRequest, async (text) => {
  if (!text || props.mode !== 'float') return
  articleExplanationRequest.value = ''
  if (!isArticlePage.value || sharedIsLoading.value) return
  lastArticleSelection.value = text.slice(0, 1600)
  openModal()
  await nextTick()
  sendMessage('教员，我读到这儿，想请您讲讲这段。')
}, { immediate: true })
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
@media (max-width: 959px) {
  .chat-toggle-btn.is-article {
    display: none;
  }
}
:global(.maoxuan-source-highlight) {
  border-radius: 6px;
  background: color-mix(in srgb, var(--vp-c-brand-soft) 75%, transparent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--vp-c-brand-soft) 45%, transparent);
  transition: background-color 0.25s ease;
}
:global(mark.maoxuan-source-highlight) {
  color: inherit;
  padding: 0 1px;
  background: color-mix(in srgb, var(--vp-c-brand-soft) 85%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-soft) 55%, transparent);
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
.sidebar-clear-all-btn {
  margin: 0 10px 8px;
  padding: 7px 9px;
  border: 0;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 11px;
  cursor: pointer;
}
.sidebar-clear-all-btn:hover:not(:disabled) {
  color: var(--vp-c-danger-1, #c43b3b);
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
.article-switch-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 24%, var(--vp-c-divider));
  background: color-mix(in srgb, var(--vp-c-brand-soft) 58%, var(--vp-c-bg));
}
.article-switch-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.45;
}
.article-switch-copy strong {
  color: var(--vp-c-text-1);
  font-size: 13px;
}
.article-switch-actions {
  display: flex;
  flex-shrink: 0;
  gap: 7px;
}
.article-switch-actions button {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}
.article-switch-actions button.primary {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
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
  -webkit-overflow-scrolling: touch;
}
.chat-messages::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-thumb {
  background-color: var(--vp-c-divider);
  border-radius: 4px;
}
.latest-reply-control {
  position: relative;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  height: 0;
}
.latest-reply-btn {
  position: absolute;
  bottom: 10px;
  padding: 5px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  color: var(--vp-c-text-2);
  font-size: 12px;
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
.message.has-reply-status {
  flex-direction: column;
  align-items: flex-start;
}

.msg-bubble {
  max-width: 85%;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  overflow-wrap: anywhere;
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
.message.welcome-arrival {
  margin-bottom: 12px;
}
.welcome-arrival .msg-bubble {
  transform-origin: left bottom;
  animation: welcome-arrive 220ms ease-out both;
}
@keyframes welcome-arrive {
  from { opacity: 0; transform: translateY(7px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.message-article-context {
  margin-bottom: 6px;
  color: var(--vp-c-text-3);
  font-size: 11px;
}
.message-selection-quote {
  margin: 0 0 9px;
  padding: 7px 9px;
  border-left: 2px solid var(--vp-c-brand-1);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--vp-c-bg) 68%, transparent);
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.5;
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
.msg-bubble :deep(.stage-direction) {
  margin-bottom: 4px;
  color: var(--vp-c-text-2);
  font-size: 0.9em;
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
.msg-body :deep(.inline-source-ref) {
  margin: 0 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 700;
  vertical-align: super;
  cursor: pointer;
}
.chat-evidence {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}
.chat-evidence-summary {
  width: fit-content;
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
}
.chat-evidence[open] > .chat-evidence-summary {
  margin-bottom: 8px;
}
.chat-evidence-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.evidence-card {
  position: relative;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.evidence-card:focus {
  outline: 1px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}
.evidence-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 20px;
  margin-bottom: 7px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
}
.evidence-card blockquote {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 2px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}
.evidence-context summary {
  margin-bottom: 6px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}
.evidence-card a {
  font-size: 13px;
  line-height: 1.45;
  color: var(--vp-c-brand-1);
  font-weight: 600;
  text-decoration: none;
  border-bottom: none;
  transition: color 0.15s ease;
}
.evidence-card a:hover {
  text-decoration: underline;
}
.reply-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 0 4px;
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.retry-btn {
  color: var(--vp-c-brand-1);
}
.retry-btn:disabled {
  opacity: 0.55;
}
.follow-up-btn {
  display: block;
  margin-top: 10px;
  padding: 4px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
}
.follow-up-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.retry-btn:hover:not(:disabled) {
  text-decoration: underline;
}
.blocked-image {
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.quick-start-area {
  width: fit-content;
  max-width: 100%;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.quick-start-area > summary {
  width: fit-content;
  padding: 4px 0;
  cursor: pointer;
}
.quick-start-list {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}
.quick-tag {
  color: var(--vp-c-text-2);
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  line-height: 1.4;
}
.quick-tag:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.reading-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 24px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.reading-context-copy,
.reading-context-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.reading-context-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5px;
}
.selection-preview {
  overflow: hidden;
  color: var(--vp-c-text-3);
  font-family: "Songti SC", "SimSun", serif;
  font-size: 11px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selection-count {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.reading-context-actions button {
  border: 0;
  background: transparent;
  color: var(--vp-c-brand-1);
  font-size: 12px;
  cursor: pointer;
}

.chat-input-area {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  padding: 20px 24px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px));
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  gap: 16px;
}
.chat-privacy-note {
  flex-shrink: 0;
  padding: 0 24px 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-size: 10px;
  text-align: center;
}
.chat-input-area textarea {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  max-height: min(170px, 30dvh);
  padding: 10px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  outline: none;
  resize: none;
  overflow-y: auto;
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.chat-input-area textarea::placeholder {
  color: var(--vp-c-text-3);
}
.chat-input-area textarea:focus {
  border-color: var(--vp-c-text-3);
  background: var(--vp-c-bg);
}
.msg-body.is-writing::after {
  display: inline-block;
  width: 5px;
  height: 0.9em;
  margin-left: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.45;
  content: '';
}
.send-btn {
  min-height: 46px;
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
.send-btn.is-stop {
  background: var(--vp-c-danger-1, #c43b3b);
  min-width: 64px;
}
.stop-label {
  font-size: 12px;
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

@media (prefers-reduced-motion: reduce) {
  .welcome-arrival .msg-bubble,
  .message.assistant .msg-bubble.thinking {
    animation: none;
  }
  .fade-scale-enter-active,
  .fade-scale-leave-active {
    transition: none;
  }
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

  .spark-link-btn {
    display: none;
  }
  .reading-context-bar {
    padding: 8px 16px;
  }
  .article-switch-banner {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
    padding: 10px 16px;
  }
  .article-switch-actions {
    width: 100%;
  }
  .article-switch-actions button {
    flex: 1;
  }
  .reading-context-copy {
    min-width: 0;
    overflow: hidden;
  }
  .reading-context-copy > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .selection-count {
    flex-shrink: 0;
  }
  .message.assistant .msg-bubble {
    max-width: 94%;
  }
  .evidence-card blockquote {
    max-height: 7.8em;
    overflow: hidden;
  }
  .chat-input-area {
    padding: 12px 16px;
    padding-bottom: 8px;
    gap: 10px;
  }
  .chat-privacy-note {
    padding: 0 16px calc(8px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px));
  }
  .send-btn {
    padding: 0 16px;
  }
}
</style>
