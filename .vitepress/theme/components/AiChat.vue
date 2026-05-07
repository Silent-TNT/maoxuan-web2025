<template>
  <div v-if="mode === 'inline' && isHome" class="chat-trigger-wrapper">
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

  <div v-if="mode === 'float' && !isHome" class="chat-float-wrapper">
    <button class="chat-toggle-btn" @click="openModal">
      ★ 咨询教员
    </button>
  </div>

  <ClientOnly>
    <Teleport to="body">
      <Transition name="fade-scale">
        <div v-if="isModalOpen" class="chat-modal-overlay" @click.self="closeModal">
          <div class="chat-modal-window">
            
            <div class="modal-header">
              <div class="modal-header-left">
                <span class="icon">★</span>
                <span class="title">教员咨询室</span>
              </div>
              <button class="close-text-btn" @click="closeModal">
                收起
              </button>
            </div>

            <div class="chat-messages" ref="messagesContainer">
              <div v-for="(msg, index) in sharedMessages" :key="index" :class="['message', msg.role]">
                <div class="msg-bubble" v-html="formatMessage(msg.content)"></div>
              </div>

              <div v-if="sharedMessages.length === 1" class="quick-start-grid">
                <button v-for="question in sampleQuestions" :key="question" class="quick-tag" @click="useSampleQuestion(question)">
                  {{ question }}
                </button>
              </div>
            </div>

            <div class="chat-input-area">
              <input 
                v-model="userInput" 
                @keyup.enter="sendMessage" 
                placeholder="问问教员..." 
                :disabled="sharedIsLoading" 
                ref="chatInputRef"
              />
              <button class="send-btn" @click="sendMessage" :disabled="sharedIsLoading || !userInput.trim()">
                <span v-if="sharedIsLoading" class="loading-dots">...</span>
                <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script>
import { ref } from 'vue'
const WELCOME_TEXT = '随便坐，莫拘束。遇到什么难处了？跟教员讲讲。'
const sharedMessages = ref([{ role: 'assistant', content: WELCOME_TEXT }])
const sharedIsLoading = ref(false)
</script>

<script setup>
import { nextTick, computed } from 'vue'
import { marked } from 'marked'
import { useData } from 'vitepress'

const props = defineProps({ mode: { type: String, default: 'inline' } })
const { frontmatter } = useData()
const isHome = computed(() => frontmatter.value.layout === 'home')

const isModalOpen = ref(false)
const userInput = ref('')
const messagesContainer = ref(null)
const chatInputRef = ref(null)

const sampleQuestions = [
  "请问教员如何看待当今之中国？",
  "最近感觉非常迷茫和内耗，该怎么办？",
  "如何看待现在的“毛选热”？",
  "《矛盾论》的精髓到底是什么？"
]

const openModal = async () => {
  isModalOpen.value = true
  scrollToBottom()
  await nextTick()
  if (chatInputRef.value) chatInputRef.value.focus()
}

const closeModal = () => {
  isModalOpen.value = false
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
      .filter(m => m.content !== WELCOME_TEXT)
      .map(m => ({ role: m.role, content: m.content }))

    const response = await fetch('/api/chat', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyMessages })
    })
    
    if (!response.ok) throw new Error('网络异常')
    const data = await response.json()
    sharedMessages.value.push({ role: 'assistant', content: data.reply || '（教员正在沉思）' })
  } catch (error) {
    sharedMessages.value.push({ role: 'assistant', content: '网络似乎出了点问题，我们稍后再谈。' })
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

const formatMessage = (text) => marked.parse(text || '')
</script>

<style scoped>
/* =========================================
   首页：极简召唤卡片 (完美对齐 VitePress 边缘)
   ========================================= */
.chat-trigger-wrapper {
  margin: 0 auto 40px auto;
  max-width: 1152px;
  padding: 0 24px;
  box-sizing: border-box;
}
/* 同步 VitePress 默认的响应式断点，实现完美对齐 */
@media (min-width: 768px) { .chat-trigger-wrapper { padding: 0 48px; } }
@media (min-width: 960px) { .chat-trigger-wrapper { padding: 0 64px; } }

.chat-trigger-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #eaeaea;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  transition: all 0.3s ease;
}
.chat-trigger-card:hover {
  border-color: #333;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.trigger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  font-size: 16px;
  color: #1a1a1a;
}
.trigger-header .icon {
  color: #c82829;
  font-size: 18px;
}
.trigger-fake-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px 16px;
  color: #888;
  font-size: 14px;
}
.send-icon {
  background: #333;
  color: white;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

/* =========================================
   阅读页：悬浮按钮
   ========================================= */
.chat-float-wrapper {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 9000;
}
.chat-toggle-btn {
  background: #333;
  color: white;
  padding: 12px 24px;
  border-radius: 30px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-weight: bold;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}
.chat-toggle-btn:hover {
  background: #111;
  transform: scale(1.05);
}

/* =========================================
   全屏沉浸式弹窗 (Modal)
   ========================================= */
.chat-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-modal-window {
  width: 100%;
  max-width: 850px;
  height: 85vh;
  background: #fff;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}
.modal-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  font-size: 16px;
}
.modal-header-left .icon {
  color: #c82829;
  font-size: 18px;
}

/* 文本形式的收起按钮 */
.close-text-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.close-text-btn:hover {
  background: #e8e8e8;
  color: #111;
}

/* 消息区 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #ffffff;
  scroll-behavior: smooth;
}
.chat-messages::-webkit-scrollbar { width: 6px; }
.chat-messages::-webkit-scrollbar-thumb { background-color: #ddd; border-radius: 4px; }

.message { margin-bottom: 24px; display: flex; width: 100%; }
.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }

.msg-bubble {
  max-width: 85%;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
}
.message.user .msg-bubble { background: #f5f5f5; border-bottom-right-radius: 2px; }
.message.assistant .msg-bubble { background: #fff; border: 1px solid #eaeaea; border-bottom-left-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);}

.msg-bubble :deep(p) { margin: 0 0 10px 0; }
.msg-bubble :deep(p:last-child) { margin-bottom: 0; }
.msg-bubble :deep(h3) { margin: 16px 0 8px 0; font-size: 16px; font-weight: bold;}
.msg-bubble :deep(ul) { padding-left: 20px; }
.msg-bubble :deep(a) { color: #c82829; text-decoration: none; border-bottom: 1px solid #c82829; font-weight: bold; }

/* 精品预设问题网格 */
.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}
.quick-tag {
  background: #fff;
  border: 1px solid #eaeaea;
  color: #555;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  line-height: 1.4;
}
.quick-tag:hover {
  border-color: #999;
  color: #111;
  background: #fafafa;
}

/* 输入区 */
.chat-input-area {
  display: flex;
  padding: 20px 24px;
  background: #fff;
  border-top: 1px solid #eee;
  gap: 16px;
}
.chat-input-area input {
  flex: 1;
  padding: 14px 20px;
  border: 1px solid #ddd;
  border-radius: 30px;
  outline: none;
  font-size: 15px;
  background: #f9f9f9;
  transition: all 0.2s ease;
}
.chat-input-area input:focus { border-color: #999; background: #fff; }
.send-btn {
  padding: 0 24px;
  background: #333;
  color: white;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-btn:hover:not(:disabled) { background: #111; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; }

/* 弹窗动画 */
.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.25s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.98) translateY(10px); }

/* =========================================
   手机端极致适配
   ========================================= */
@media (max-width: 640px) {
  /* 手机端恢复较小的边距 */
  .chat-trigger-wrapper { padding: 0 24px; }
  .chat-float-wrapper { bottom: 20px; right: 20px; }
  
  .chat-modal-window {
    height: 100vh;
    border-radius: 0;
    max-width: 100%;
  }
  .quick-start-grid { grid-template-columns: 1fr; }
  .chat-input-area { padding: 12px 16px; gap: 10px; }
  .send-btn { padding: 0 16px; }
}
</style>