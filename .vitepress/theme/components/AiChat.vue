<template>
  <div v-if="mode === 'inline' && isHome" class="chat-trigger-wrapper">
    <div class="chat-trigger-container">
      <div class="chat-trigger-card" @click="openModal">
        <div class="trigger-header">
          <span class="icon">★</span>
          <span class="title">毛选阅读咨询室</span>
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

  <div v-if="mode === 'float'" class="chat-float-wrapper" :class="{ 'is-home': isHome }">
    <button
      v-if="isArticlePage && selectionToolbarVisible && !isModalOpen"
      type="button"
      class="selection-explain-btn"
      :style="selectionToolbarStyle"
      @mousedown.prevent
      @click="explainSelectionFromToolbar"
    >
      <svg class="selection-action-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.25 4.5h11.5v8.25H9l-3.75 2.75v-2.75h-1z" />
        <path d="M7 7.35h6M7 9.8h4" />
      </svg>
      <span>解释这段</span>
    </button>
    <button v-if="!isHome" class="chat-toggle-btn" @click="openModal">
      ★ 阅读咨询室
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
            >
              <div class="modal-header">
                <div class="modal-header-left">
                  <span class="icon">★</span>
                  <span id="chat-modal-title" class="title">毛选阅读咨询室</span>
                  <span class="assistant-badge">AI · 以原文为准</span>
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
                aria-live="polite"
                :aria-busy="sharedIsLoading"
                @click.capture="handleArticleLinkClick"
              >
                <div
                  v-for="(msg, index) in sharedMessages"
                  :key="index"
                  :class="['message', msg.role]"
                >
                  <div class="msg-bubble">
                    <div v-if="msg.role === 'user' && msg.articleTitle" class="message-article-context">
                      来自《{{ cleanArticleTitle(msg.articleTitle) }}》
                    </div>
                    <blockquote v-if="msg.role === 'user' && msg.selectedText" class="message-selection-quote">
                      {{ compactText(msg.selectedText, 96) }}
                    </blockquote>
                    <div
                      class="msg-body"
                      v-html="formatMessage(msg.content)"
                    ></div>
                    <div
                      v-if="msg.role === 'assistant' && uniqueSources(msg.sources).length"
                      class="chat-evidence"
                    >
                      <div class="chat-evidence-label">原文依据（与回答编号对应）</div>
                      <div class="chat-evidence-list">
                        <article
                          v-for="(s, sourceIndex) in uniqueSources(msg.sources)"
                          :key="`${s.sourceNumber || sourceIndex + 1}:${s.id || s.path || s.title}`"
                          class="evidence-card"
                        >
                          <span class="evidence-number">[{{ s.sourceNumber || sourceIndex + 1 }}]</span>
                          <blockquote v-if="s.text">{{ sourceExcerpt(s) }}</blockquote>
                          <a :href="sourceHref(s)">查看《{{ s.title }}》（{{ s.volume }}）全文 →</a>
                        </article>
                      </div>
                    </div>
                    <div
                      v-if="msg.role === 'assistant' && retrievalNotice(msg.retrievalStatus)"
                      class="retrieval-notice"
                    >
                      {{ retrievalNotice(msg.retrievalStatus) }}
                    </div>
                    <button
                      v-if="msg.role === 'assistant' && msg.retryText"
                      type="button"
                      class="retry-btn"
                      :disabled="sharedIsLoading"
                      @click="retryMessage(index, msg.retryText)"
                    >
                      重新回答
                    </button>
                    <div
                      v-if="msg.role === 'assistant' && msg.suggestions?.length"
                      class="follow-up-area"
                    >
                      <div class="follow-up-label">接着聊</div>
                      <div class="follow-up-list">
                        <button
                          v-for="suggestion in msg.suggestions"
                          :key="suggestion"
                          type="button"
                          :disabled="sharedIsLoading"
                          @click="useFollowUp(suggestion)"
                        >{{ suggestion }}</button>
                      </div>
                    </div>
                    <div
                      v-if="msg.role === 'assistant' && msg.suggestions?.length"
                      class="feedback-area"
                    >
                      <span>这次讲明白了吗？</span>
                      <button
                        type="button"
                        :class="{ active: msg.feedback === 'helpful' }"
                        @click="setMessageFeedback(msg, 'helpful')"
                      >有帮助</button>
                      <button
                        type="button"
                        :class="{ active: msg.feedback === 'unhelpful' }"
                        @click="setMessageFeedback(msg, 'unhelpful')"
                      >没解决</button>
                    </div>
                    <div
                      v-if="msg.role === 'assistant' && msg.feedback === 'unhelpful'"
                      class="feedback-reasons"
                    >
                      <button
                        v-for="reason in feedbackReasons"
                        :key="reason"
                        type="button"
                        :class="{ active: msg.feedbackReason === reason }"
                        @click="setFeedbackReason(msg, reason)"
                      >{{ reason }}</button>
                    </div>
                  </div>
                </div>

                <div v-if="sharedIsLoading && !isReceiving" class="message assistant">
                  <div class="msg-bubble thinking">莫急，正在翻检原文，把问题理一理…</div>
                </div>

                <div v-if="sharedMessages.length === 1 && !sharedIsLoading" class="quick-start-area">
                  <div class="quick-start-heading">不妨先从这几个问题聊起：</div>
                  <div class="quick-start-grid">
                  <button
                    v-for="question in sampleQuestions"
                    :key="question.question"
                    class="quick-tag"
                    @click="useSampleQuestion(question)"
                  >
                    <span>{{ question.category }}</span>
                    <strong>{{ question.question }}</strong>
                  </button>
                  </div>
                </div>
              </div>

              <div v-if="readingContextTitle" class="reading-context-bar">
                <div class="reading-context-main">
                  <div class="reading-context-copy">
                    <span>当前阅读：《{{ readingContextTitle }}》</span>
                    <span v-if="lastArticleSelection" class="selection-count">
                      已选中 {{ lastArticleSelection.length }} 字
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
                <input
                  v-model="userInput"
                  @keyup.enter="submitMessage" @focus="focusChatInput"
                  placeholder="把篇名、原文或眼前的难题讲具体些…"
                  aria-label="输入毛选阅读问题"
                  :disabled="sharedIsLoading"
                  ref="chatInputRef"
                />
                <button
                  class="send-btn"
                  :class="{ 'is-stop': sharedIsLoading }"
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
              <div class="chat-privacy-note">检索范围：毛选一至四卷。历史保存在本机；提问会发送至 AI 服务。</div>
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

defineProps({ mode: { type: String, default: 'inline' } })
const { frontmatter, page } = useData()
const router = useRouter()
const isHome = computed(() => frontmatter.value.layout === 'home')
const isArticlePage = computed(() => /^第[一二三四]卷\/\d{3}-.+\.md$/u.test(page.value?.relativePath || ''))

const userInput = ref('')
const messagesContainer = ref(null)
const chatInputRef = ref(null)
const chatModalWindow = ref(null)
const isReceiving = ref(false)
const showSessionSidebar = ref(false)
const openSessionMenuId = ref(null)
const lastArticleSelection = ref('')
const selectionToolbarVisible = ref(false)
const articleSwitchNotice = ref(null)
const dismissedSwitchPath = ref('')
let previousArticleLocation = null
const selectionToolbarPosition = ref({ left: 16, top: 16 })
const selectionToolbarStyle = computed(() => ({
  left: `${selectionToolbarPosition.value.left}px`,
  top: `${selectionToolbarPosition.value.top}px`,
}))
const selectionPreview = computed(() => compactText(lastArticleSelection.value, 92))
const readingContextTitle = computed(() => {
  if (!isArticlePage.value) return ''
  const title = page.value?.title || ''
  return title
    .replace(/全文.*$/u, '')
    .replace(/\s*[|｜-]\s*毛泽东选集.*$/u, '')
    .trim()
})
let viewportCleanup = null
let activeAbortController = null
let requestTimeoutId = null
let stopRequested = false
let timeoutTriggered = false
let quoteHighlightTimer = null

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
  scrollToBottom()
  chatInputRef.value?.focus()
}

const handleSwitchSession = async (id) => {
  if (sharedIsLoading.value) return
  switchSession(id)
  userInput.value = ''
  showSessionSidebar.value = false
  await nextTick()
  refreshArticleSwitchNotice()
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

const handleClearAllSessions = async () => {
  if (sharedIsLoading.value) return
  const ok = await showChatConfirm('这会删除本机保存的全部历史对话，且无法恢复。确定清空吗？', '清空全部历史')
  if (!ok) return
  clearAllSessions()
  showSessionSidebar.value = false
  userInput.value = ''
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
  {
    category: '读懂原文',
    question: '《实践论》说“感觉到了的东西，我们不能立刻理解它”，这句话是什么意思？',
  },
  {
    category: '辨清概念',
    question: '主要矛盾和矛盾的主要方面有什么区别？能用生活中的例子讲明白吗？',
  },
  {
    category: '理解篇章',
    question: '《论持久战》为什么能判断中国不会亡，也不能速胜？',
  },
  {
    category: '联系实际',
    question: '手头事情很多、总抓不住重点，怎样用“抓主要矛盾”的方法理清头绪？',
  },
]

const feedbackReasons = ['答非所问', '原文不准', '解释太绕', '建议不具体']

const openModal = async () => {
  refreshArticleSwitchNotice()
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
    lockPageScroll()
    nextTick(() => {
      bindVisualViewport()
      chatInputRef.value?.focus({ preventScroll: true })
    })
  } else {
    unlockPageScroll()
    viewportCleanup?.()
    viewportCleanup = null
  }
})

watch(() => page.value?.relativePath, async () => {
  if (!isModalOpen.value) unlockPageScroll()
  cancelQuotedSourceHighlight()
  lastArticleSelection.value = ''
  selectionToolbarVisible.value = false
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
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previousArticleLocation = currentArticleLocation()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('selectionchange', rememberArticleSelection)
  document.addEventListener('mouseup', rememberArticleSelection)
  nextTick(scheduleQuotedSourceHighlight)
})

onUnmounted(() => {
  unlockPageScroll()
  cancelQuotedSourceHighlight()
  viewportCleanup?.()
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('selectionchange', rememberArticleSelection)
  document.removeEventListener('mouseup', rememberArticleSelection)
})

function rememberArticleSelection() {
  if (!isArticlePage.value) {
    lastArticleSelection.value = ''
    selectionToolbarVisible.value = false
    return
  }
  const selection = window.getSelection()
  const text = selection?.toString().trim()
  if (!text || text.length < 2) {
    if (!isModalOpen.value) selectionToolbarVisible.value = false
    return
  }
  const range = selection.rangeCount ? selection.getRangeAt(0) : null
  const startElement = range?.startContainer?.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range?.startContainer?.parentElement
  const endElement = range?.endContainer?.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range?.endContainer?.parentElement
  const article = startElement?.closest('.vp-doc')
  if (article && article === endElement?.closest('.vp-doc')) {
    lastArticleSelection.value = text.slice(0, 1600)
    const rect = range?.getBoundingClientRect()
    if (rect && rect.width > 0) {
      const buttonWidth = 126
      const cardButtonWidth = 126
      const gap = 8
      const groupWidth = buttonWidth + gap + cardButtonWidth
      const groupLeft = Math.max(12, Math.min(window.innerWidth - groupWidth - 12, rect.left + rect.width / 2 - groupWidth / 2))
      selectionToolbarPosition.value = {
        left: groupLeft,
        top: Math.max(12, rect.top - 44),
      }
      selectionToolbarVisible.value = true
    }
  } else {
    lastArticleSelection.value = ''
    selectionToolbarVisible.value = false
  }
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
  nextTick(() => chatInputRef.value?.focus())
}

async function startCurrentArticleConversation() {
  if (sharedIsLoading.value) return
  createSession()
  articleSwitchNotice.value = null
  dismissedSwitchPath.value = ''
  userInput.value = ''
  await nextTick()
  scrollToBottom()
  chatInputRef.value?.focus()
}

function clearReadingSelection() {
  lastArticleSelection.value = ''
  selectionToolbarVisible.value = false
  window.getSelection()?.removeAllRanges()
}

function explainSelection() {
  if (!lastArticleSelection.value || sharedIsLoading.value) return
  sendMessage('请结合上下文解释我刚才选中的这段原文。')
}

async function explainSelectionFromToolbar() {
  if (!lastArticleSelection.value || sharedIsLoading.value) return
  selectionToolbarVisible.value = false
  openModal()
  await nextTick()
  sendMessage('请结合上下文解释我刚才选中的这段原文。')
}

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
  // 跳转文章时不能只等异步 watch 清理，否则新页面可能短暂继承滚动锁。
  unlockPageScroll()
}

function onSparkDonateClick() {
  BaiduTrack.chatSparkLink()
  closeModal()
}

const useSampleQuestion = (question) => {
  sendMessage(question.question)
}

const useFollowUp = (suggestion) => {
  sendMessage(suggestion)
}

const setMessageFeedback = (message, value) => {
  message.feedback = value
  if (value === 'helpful') message.feedbackReason = undefined
  BaiduTrack.chatFeedback(value, message.retrievalStatus || 'unknown')
}

const setFeedbackReason = (message, reason) => {
  message.feedbackReason = reason
  BaiduTrack.chatFeedbackReason(reason, message.retrievalStatus || 'unknown')
}

const submitMessage = () => {
  sendMessage(userInput.value)
}

const retryMessage = (index, text) => {
  if (sharedIsLoading.value) return
  sharedMessages.value.splice(index, 1)
  sendMessage(text, { appendUser: false })
}

const stopGeneration = () => {
  if (!sharedIsLoading.value || !activeAbortController) return
  stopRequested = true
  activeAbortController.abort()
}

async function readNdjsonStream(response, messageIndex) {
  if (!response.body) throw new Error('回答服务没有返回可读取的内容')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload = null

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === 'delta' && event.delta) {
        isReceiving.value = true
        sharedMessages.value[messageIndex].content += event.delta
        if (sharedMessages.value[messageIndex].content.length % 48 < event.delta.length) {
          scrollToBottom()
        }
      } else if (event.type === 'done') {
        donePayload = event
      } else if (event.type === 'error') {
        throw new Error(event.error || '回答服务发生错误')
      }
    }
    if (done) break
  }
  if (!donePayload) throw new Error('回答流意外中断')
  return donePayload
}

const sendMessage = async (inputText, options = {}) => {
  const text = typeof inputText === 'string' ? inputText.trim() : ''
  if (!text || sharedIsLoading.value) return
  const readingContext = currentReadingContext()

  if (options.appendUser !== false) {
    sharedMessages.value.push({
      role: 'user',
      content: text,
      articleTitle: readingContext?.title || undefined,
      articlePath: readingContext?.path || undefined,
      selectedText: readingContext?.selectedText || undefined,
    })
  }
  userInput.value = ''
  sharedIsLoading.value = true
  isReceiving.value = false
  stopRequested = false
  timeoutTriggered = false
  activeAbortController = new AbortController()
  requestTimeoutId = window.setTimeout(() => {
    timeoutTriggered = true
    activeAbortController?.abort()
  }, 60000)
  let streamMessageIndex = -1
  scrollToBottom()

  try {
    const historyMessages = sharedMessages.value
      .filter((m) => m.content !== WELCOME_TEXT && !m.retryText)
      .map((m) => ({ role: m.role, content: m.content }))

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: historyMessages,
        readingContext,
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

    sharedMessages.value.push({ role: 'assistant', content: '' })
    streamMessageIndex = sharedMessages.value.length - 1
    const data = await readNdjsonStream(response, streamMessageIndex)
    const ragLabel = data.rag ? 'rag' : 'no_rag'
    BaiduTrack.chatSend(ragLabel)

    Object.assign(sharedMessages.value[streamMessageIndex], {
      content: data.reply || sharedMessages.value[streamMessageIndex].content || '（教员正在沉思）',
      sources: data.sources?.length ? uniqueSources(data.sources) : undefined,
      suggestions: data.suggestions?.length ? data.suggestions.slice(0, 3) : undefined,
      retrievalStatus: data.retrievalStatus,
    })
  } catch (err) {
    const partial = streamMessageIndex >= 0 ? sharedMessages.value[streamMessageIndex] : null
    if (err?.name === 'AbortError' && stopRequested) {
      if (partial) {
        partial.content = `${partial.content.trim()}\n\n（已停止生成）`.trim()
        partial.retryText = text
      } else {
        sharedMessages.value.push({
          role: 'assistant',
          content: '已停止生成。',
          retryText: text,
        })
      }
    } else {
      const serviceUnavailable = err?.message === 'fetch failed'
      const hint = timeoutTriggered
        ? '回答超过一分钟仍未完成，已经自动停止。'
        : serviceUnavailable
          ? '回答服务暂时无法连接模型接口，请稍后重试。'
          : err?.message?.includes('请求失败') || err?.message?.includes('API')
            ? err.message
            : '网络似乎出了点问题，我们稍后再谈。'
      if (partial?.content?.trim()) {
        partial.content = `${partial.content.trim()}\n\n（回答中断：${hint}）`
        partial.retryText = text
      } else {
        if (partial) sharedMessages.value.splice(streamMessageIndex, 1)
        sharedMessages.value.push({ role: 'assistant', content: hint, retryText: text })
      }
    }
  } finally {
    if (requestTimeoutId) window.clearTimeout(requestTimeoutId)
    requestTimeoutId = null
    activeAbortController = null
    sharedIsLoading.value = false
    isReceiving.value = false
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
    // 同一篇文章可以有多个独立检索片段，编号不同就应分别展示。
    const key = s.sourceNumber
      ? `number:${s.sourceNumber}`
      : `source:${s.id || ''}:${s.path || s.title}:${s.evidenceText || s.text || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sourceExcerpt(source) {
  const text = (source?.evidenceText || source?.text || '').replace(/\s+/g, ' ').trim()
  if (text.length <= 240) return text
  return `${text.slice(0, 240)}…`
}

function retrievalNotice(status) {
  if (status === 'failed') return '这次原文检索没有成功，回答未经过原文核对。'
  if (status === 'empty') return '这次没有找到足够相关的原文，请把回答当作一般解释。'
  if (status === 'unavailable') return '当前未启用原文检索，请以原著正文为准。'
  return ''
}

function sourceHref(s) {
  const p = s.path || ''
  const articlePath = p.endsWith('.html') ? p : `${p}.html`
  const quote = (s.evidenceText || '').replace(/\s+/g, ' ').trim().slice(0, 48)
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

function highlightQuotedSource() {
  const quote = new URLSearchParams(window.location.search).get('quote')?.replace(/\s+/g, ' ').trim()
  if (!quote) return true
  const candidates = [...document.querySelectorAll('.vp-doc p, .vp-doc blockquote')]
  const target = candidates.find((element) => element.textContent?.replace(/\s+/g, ' ').includes(quote))
  if (!target) return false
  document.querySelectorAll('.maoxuan-source-highlight').forEach((element) => {
    element.classList.remove('maoxuan-source-highlight')
  })
  target.classList.add('maoxuan-source-highlight')
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

function scheduleQuotedSourceHighlight() {
  cancelQuotedSourceHighlight()
  const retryDelays = [0, 180, 600, 1200]
  const tryHighlight = (attempt = 0) => {
    if (highlightQuotedSource() || attempt >= retryDelays.length - 1) {
      quoteHighlightTimer = null
      return
    }
    quoteHighlightTimer = window.setTimeout(
      () => tryHighlight(attempt + 1),
      retryDelays[attempt + 1],
    )
  }
  quoteHighlightTimer = window.setTimeout(() => tryHighlight(0), retryDelays[0])
}

async function handleArticleLinkClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor || !messagesContainer.value?.contains(anchor)) return
  const path = normalizeArticlePath(anchor.getAttribute('href'))
  if (!path) return
  event.preventDefault()
  closeModal()
  await nextTick()
  await router.push(path)
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
chatRenderer.link = ({ href, title, tokens }) => {
  const label = chatRenderer.parser.parseInline(tokens)
  const safeHref = safeChatHref(href)
  if (!safeHref) return label
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${label}</a>`
}

function formatMessage(text) {
  const html = marked.parse(text || '', { renderer: chatRenderer })
  return html
    .replace(/\[(\d+)\](?!\()/g, '<sup class="inline-source-ref">[$1]</sup>')
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
.selection-explain-btn {
  position: fixed;
  z-index: 9998;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 126px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid #b4232b;
  border-radius: 999px;
  background: #b4232b;
  color: #fff;
  box-shadow: 0 6px 18px rgba(91, 31, 34, 0.22);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}
.selection-explain-btn:hover {
  background: #9f1f27;
  box-shadow: 0 8px 22px rgba(91, 31, 34, 0.28);
  transform: translateY(-2px);
}
.selection-action-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
:global(.maoxuan-source-highlight) {
  border-radius: 6px;
  background: color-mix(in srgb, var(--vp-c-brand-soft) 75%, transparent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--vp-c-brand-soft) 45%, transparent);
  transition: background-color 0.25s ease;
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
.assistant-badge {
  color: var(--vp-c-text-3);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 2px 8px;
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
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 700;
  vertical-align: super;
}
.chat-evidence {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}
.chat-evidence-label,
.follow-up-label {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
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
.retrieval-notice {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--vp-c-warning-soft, #fff7e6);
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.retry-btn {
  margin-top: 12px;
  padding: 7px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.follow-up-area {
  margin-top: 14px;
}
.follow-up-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.follow-up-list button {
  padding: 7px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
}
.follow-up-list button:hover:not(:disabled),
.retry-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.feedback-area {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  color: var(--vp-c-text-3);
  font-size: 11px;
}
.feedback-area button {
  padding: 3px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 11px;
  cursor: pointer;
}
.feedback-area button.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.feedback-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
}
.feedback-reasons button {
  padding: 4px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
  font-size: 11px;
  cursor: pointer;
}
.feedback-reasons button.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.blocked-image {
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.quick-start-area {
  margin-top: 6px;
}
.quick-start-heading {
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.quick-tag strong {
  color: var(--vp-c-text-1);
  font-size: 14px;
}
.quick-tag span {
  color: var(--vp-c-text-3);
  font-size: 12px;
}
.quick-tag:hover {
  border-color: var(--vp-c-text-3);
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
  .assistant-badge,
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
