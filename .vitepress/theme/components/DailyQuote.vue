<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { quotes } from '../../data/quotes.js'

const currentIndex = ref(0)
const currentQuote = computed(() => quotes[currentIndex.value] || { text: '', source: '' })
const quoteAnimated = ref(false)
const reducedMotion = ref(false)
let quoteTimer = null
let motionPreference = null
let quoteHovered = false
let quoteFocused = false

function randomize() {
  if (!quotes.length) return
  // 从其余 N-1 条中抽取，再跳过当前下标，确保每次切换都是另一句。
  const hasCurrent = currentIndex.value >= 0
  let nextIndex = Math.floor(Math.random() * (quotes.length - (hasCurrent ? 1 : 0)))
  if (hasCurrent && nextIndex >= currentIndex.value) nextIndex += 1
  if (quotes.length === 1) nextIndex = 0
  currentIndex.value = nextIndex
}

function scheduleQuote(delay = 8000) {
  clearTimeout(quoteTimer)
  if (quotes.length < 2 || reducedMotion.value || quoteHovered || quoteFocused || document.hidden) return
  quoteTimer = window.setTimeout(() => {
    quoteAnimated.value = true
    randomize()
    scheduleQuote()
  }, delay)
}

function stepQuote() {
  quoteAnimated.value = false
  randomize()
  scheduleQuote(8000)
}

function holdQuote(event) {
  if (event.pointerType === 'touch') return
  quoteHovered = true
  clearTimeout(quoteTimer)
}

function releaseQuote() {
  quoteHovered = false
  scheduleQuote(8000)
}

function focusQuote(event) {
  quoteFocused = event.target.matches(':focus-visible')
  if (quoteFocused) clearTimeout(quoteTimer)
}

function blurQuote() {
  quoteFocused = false
  scheduleQuote(8000)
}

function syncQuoteMotion() {
  reducedMotion.value = motionPreference.matches
  scheduleQuote()
}

onMounted(() => {
  randomize()
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', syncQuoteMotion)
  document.addEventListener('visibilitychange', syncQuoteMotion)
  syncQuoteMotion()
})

onUnmounted(() => {
  clearTimeout(quoteTimer)
  motionPreference?.removeEventListener('change', syncQuoteMotion)
  document.removeEventListener('visibilitychange', syncQuoteMotion)
})
</script>

<template>
  <div class="quote-container">
    <div
      class="quote-card"
      role="button"
      tabindex="0"
      aria-label="切换下一条每日一语"
      @click="stepQuote"
      @keydown.enter.prevent="stepQuote"
      @keydown.space.prevent="stepQuote"
      @pointerenter="holdQuote"
      @pointerleave="releaseQuote"
      @focus="focusQuote"
      @blur="blurQuote"
    >
      <div :key="currentIndex" class="content-wrapper" :class="{ 'quote-auto-enter': quoteAnimated }">
        <div class="main-text">“ {{ currentQuote.text }} ”</div>
        <div class="source-text">—— {{ currentQuote.source }}</div>
      </div>
      <div class="seal">每日<br>一语</div>
    </div>
  </div>
</template>

<style scoped>
.quote-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
  margin-bottom: 60px;
  padding: 0 20px; /* 防止手机贴边 */
}

.quote-card {
  position: relative;
  width: 100%;
  max-width: 600px; /* 限制最大宽度，电脑上不至于太宽 */
  min-height: 140px; /* 给一个最小高度，防止跳动 */
  padding: 30px 40px;
  
  /* 🔴 极简红框风格 */
  border: 1px solid rgba(210, 43, 43, 0.3); /* 细红线 */
  border-left: 4px solid #d22b2b; /* 左侧加粗，像书签 */
  background-color: var(--vp-c-bg-soft); /* 跟随主题的柔和背景 */
  border-radius: 4px;
  
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quote-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(210, 43, 43, 0.1);
  border-color: rgba(210, 43, 43, 0.6);
}

.content-wrapper {
  text-align: center;
  width: 100%;
}

/* 正文：横排宋体 */
.main-text {
  font-family: "Songti SC", "SimSun", serif;
  font-size: 20px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  font-weight: 500;
  margin-bottom: 15px;
  letter-spacing: 1px;
}

/* 来源：小字 */
.source-text {
  font-size: 13px;
  color: var(--vp-c-text-2);
  opacity: 0.8;
  font-family: sans-serif;
}

/* 印章：放在右下角 */
.seal {
  position: absolute;
  bottom: 15px;
  right: 15px;
  width: 32px;
  height: 32px;
  border: 1px solid #d22b2b;
  border-radius: 4px;
  color: #d22b2b;
  font-size: 9px;
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 1.1;
  text-align: center;
  opacity: 0.5;
  transform: rotate(-10deg);
}

/* 直接替换内容后淡入，避免先移除旧内容造成空白。 */
.quote-auto-enter { animation: quoteFadeIn 0.7s ease-in-out; }
@keyframes quoteFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.quote-card:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .quote-auto-enter { animation: none; }
  .quote-card { transition: none; }
}

/* 移动端适配 */
@media (max-width: 600px) {
  .quote-card {
    padding: 25px 20px;
    min-height: 120px;
  }
  .main-text {
    font-size: 18px; /* 手机字号稍微小一点 */
  }
}
</style>