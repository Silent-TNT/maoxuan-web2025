<template>
  <div class="chat-container">
    <button class="chat-toggle-btn" @click="isOpen = !isOpen">
      {{ isOpen ? '收起' : '🔥 咨询教员' }}
    </button>

    <div v-if="isOpen" class="chat-panel">
      <div class="chat-header">星火咨询室</div>
      
      <div class="chat-messages" ref="messagesContainer">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <div class="msg-bubble" v-html="formatMessage(msg.content)"></div>
        </div>
      </div>

      <div class="chat-input-area">
        <input 
          v-model="userInput" 
          @keyup.enter="sendMessage" 
          placeholder="跟教员讲讲你的难处..." 
          :disabled="isLoading"
        />
        <button @click="sendMessage" :disabled="isLoading || !userInput.trim()">
          {{ isLoading ? '思考中...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const isOpen = ref(false)
const userInput = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)

// 初始欢迎语
const WELCOME_TEXT = '随便坐，莫拘束。遇到什么难处了？跟教员讲讲。'
const messages = ref([
  { role: 'assistant', content: WELCOME_TEXT }
])

const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return
  
  const text = userInput.value
  messages.value.push({ role: 'user', content: text })
  userInput.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    // 💡 核心改动：提取历史记录，让教员能记住你之前说了什么
    const historyMessages = messages.value
      .filter(m => m.content !== WELCOME_TEXT) // 过滤掉开场白，节省 Token
      .map(m => ({
        role: m.role,
        content: m.content
      }))

    const response = await fetch('/api/chat', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyMessages }) // 发送整个对话数组
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

// 简单的换行处理，后续可引入 markdown-it 解析
const formatMessage = (text) => {
  if (!text) return ''
  return text.replace(/\n/g, '<br>')
}
</script>

<style scoped>
.chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: sans-serif;
}
.chat-toggle-btn {
  background: #c82829;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 30px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-weight: bold;
}
.chat-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 350px;
  height: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #eee;
}
.chat-header {
  background: #c82829;
  color: white;
  padding: 15px;
  font-weight: bold;
  text-align: center;
}
.chat-messages {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  background: #f9f9f9;
}
.message {
  margin-bottom: 15px;
  display: flex;
}
.message.user {
  justify-content: flex-end;
}
.msg-bubble {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}
.message.user .msg-bubble {
  background: #e3f2fd;
  color: #0d47a1;
}
.message.assistant .msg-bubble {
  background: white;
  border: 1px solid #ddd;
  color: #333;
}
.chat-input-area {
  display: flex;
  padding: 10px;
  border-top: 1px solid #eee;
  background: white;
}
.chat-input-area input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
}
.chat-input-area button {
  margin-left: 10px;
  padding: 8px 15px;
  background: #c82829;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}
.chat-input-area button:disabled {
  background: #ccc;
}
</style>