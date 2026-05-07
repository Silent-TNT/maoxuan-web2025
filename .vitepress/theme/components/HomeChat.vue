<template>
  <div class="home-chat-wrapper">
    <div class="home-chat-card">
      <div class="chat-header">
        <span class="header-icon">🔥</span>
        <span class="header-title">星火咨询室</span>
        <span class="header-subtitle">用教员的视角，解开现实的麻团</span>
      </div>
      
      <div class="chat-messages" ref="messagesContainer">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <div class="msg-bubble" v-html="formatMessage(msg.content)"></div>
        </div>

        <div v-if="messages.length === 1" class="quick-start-area">
          <div class="quick-title">💡 你可以试着这样问：</div>
          <div class="quick-tags">
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
      </div>

      <div class="chat-input-area">
        <input 
          v-model="userInput" 
          @keyup.enter="sendMessage" 
          placeholder="遇到什么难处了？跟教员讲讲..." 
          :disabled="isLoading"
        />
        <button 
          class="send-btn" 
          @click="sendMessage" 
          :disabled="isLoading || !userInput.trim()"
        >
          <svg v-if="!isLoading" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          <span v-else class="loading-dots">思考中...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { marked } from 'marked'

const userInput = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)

// 初始欢迎语
const WELCOME_TEXT = '随便坐，莫拘束。遇到什么难处了？跟教员讲讲。'
const messages = ref([
  { role: 'assistant', content: WELCOME_TEXT }
])

// 👇 精品预设问题数组，可随时在此替换修改 👇
const sampleQuestions = [
  "刚入职新公司，发现部门内部派系斗争严重，我该怎么破局？",
  "现在大环境不好，创业接连受挫，我该怎么调整心态和战略？",
  "教员，我最近感觉非常迷茫和内耗，总是抓不住重点，该怎么办？"
]

// 一键填入并发送预设问题
const useSampleQuestion = (question) => {
  userInput.value = question
  sendMessage()
}

const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return
  
  const text = userInput.value
  messages.value.push({ role: 'user', content: text })
  userInput.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    const historyMessages = messages.value
      .filter(m => m.content !== WELCOME_TEXT)
      .map(m => ({
        role: m.role,
        content: m.content
      }))

    const response = await fetch('/api/chat', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyMessages })
    })
    
    if (!response.ok) throw new Error('网络响应异常')
    
    const data = await response.json()
    messages.value.push({ role: 'assistant', content: data.reply || '（教员正在沉思，请稍后再试）' })
  } catch (error) {
    console.error('聊天请求失败:', error)
    messages.value.push({ role: 'assistant', content: '网络似乎出了点问题，我们稍后再谈。' })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatMessage = (text) => {
  if (!text) return ''
  return marked.parse(text)
}
</script>

<style scoped>
/* 外层包裹器：适配 VitePress 的最大宽度 1152px */
.home-chat-wrapper {
  width: 100%;
  max-width: 1152px; /* 与下方的毛选四卷卡片宽度对齐 */
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

/* 核心卡片样式 */
.home-chat-card {
  width: 100%;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid #eaeaea;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部标题区 */
.chat-header {
  background: linear-gradient(135deg, #c82829 0%, #a61c1d 100%);
  padding: 16px 20px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  color: white;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.header-subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 400;
}

/* 消息流转区：降低高度，减少压迫感 */
.chat-messages {
  height: 320px; /* 从 450px 降低到 320px */
  overflow-y: auto;
  padding: 24px;
  background: #fafafa;
  scroll-behavior: smooth;
  position: relative;
}

/* 隐藏滚动条让视觉更干净 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-thumb {
  background-color: #ddd;
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

/* 气泡基础样式 */
.msg-bubble {
  max-width: 85%;
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.message.user .msg-bubble {
  background: #f4f4f5; /* 调整为更极简的浅灰色，呼应下方卡片 */
  color: #333;
  border-bottom-right-radius: 4px;
}

.message.assistant .msg-bubble {
  background: #ffffff;
  border: 1px solid #eaeaea;
  border-bottom-left-radius: 4px;
}

/* =========================================
   Markdown 渲染内部元素穿透
   ========================================= */
.msg-bubble :deep(p) { margin-top: 0; margin-bottom: 12px; }
.msg-bubble :deep(p:last-child) { margin-bottom: 0; }
.msg-bubble :deep(h1), .msg-bubble :deep(h2), .msg-bubble :deep(h3) { margin-top: 16px; margin-bottom: 12px; font-weight: bold; color: #1a1a1a; }
.msg-bubble :deep(ul), .msg-bubble :deep(ol) { padding-left: 24px; margin-bottom: 12px; }
.msg-bubble :deep(li) { margin-bottom: 6px; }
.msg-bubble :deep(strong) { color: #c82829; font-weight: bold; }
.msg-bubble :deep(a) { color: #c82829; text-decoration: none; border-bottom: 1px solid #c82829; font-weight: bold; transition: all 0.2s ease; display: inline-block; margin-top: 4px; }
.msg-bubble :deep(a:hover) { background-color: #fce8e8; }

/* =========================================
   动态引导区：精品预设问题样式
   ========================================= */
.quick-start-area {
  margin-top: 20px;
  padding-left: 10px;
  animation: fadeIn 0.8s ease;
}

.quick-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
}

.quick-tags {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.quick-tag {
  background: white;
  border: 1px solid #e2e2e2;
  color: #555;
  padding: 10px 16px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  line-height: 1.4;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}

.quick-tag:hover {
  border-color: #c82829;
  color: #c82829;
  background: #fffafa;
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 底部输入区 */
.chat-input-area {
  display: flex;
  padding: 16px 20px;
  background: #ffffff;
  border-top: 1px solid #eaeaea;
  align-items: center;
  gap: 12px;
}

.chat-input-area input {
  flex: 1;
  padding: 14px 20px;
  border: 1px solid #ddd;
  border-radius: 30px;
  outline: none;
  font-size: 15px;
  background: #f9f9f9;
  transition: border-color 0.2s ease;
}

.chat-input-area input:focus { border-color: #c82829; background: #fff; }

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  height: 48px;
  background: #c82829;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s ease;
}

.send-btn:hover:not(:disabled) { background: #a61c1d; }
.send-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }

/* 移动端适配 */
@media (max-width: 640px) {
  .home-chat-wrapper { padding: 20px 16px; }
  .chat-messages { height: 280px; }
  .quick-tag { font-size: 13px; padding: 8px 14px; }
}
</style>