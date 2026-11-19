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
  min-height: 236px;
  padding: 30px 40px;
  border-radius: 4px;

  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.quote-card::after {
  content: '';
  position: absolute;
  inset: 20px 0 20px auto;
  width: 4px;
  border-radius: 2px;
  background-color: #d22b2b;
  pointer-events: none;
}

@media (min-width: 1200px) {
  .quote-card::after {
    inset-block: 40px;
  }
}

.content-wrapper {
  text-align: left;
  width: 100%;
  max-width: 480px;
  overflow-wrap: anywhere;
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
  text-align: right;
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
}

/* 移动端适配 */
@media (max-width: 600px) {
  .quote-card {
    padding: 16px 20px;
    min-height: 248px;
  }
  .main-text {
    font-size: 18px; /* 手机字号稍微小一点 */
  }
}

@media (max-width: 359px) {
  .quote-card {
    min-height: 280px;
  }
}
</style>
