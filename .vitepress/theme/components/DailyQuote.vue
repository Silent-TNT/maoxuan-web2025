<script setup>
import { ref, onMounted } from 'vue'
import { quotes } from '../../data/quotes.js'

const currentQuote = ref({ text: '', source: '' })
const isAnimating = ref(false)

const randomize = () => {
  isAnimating.value = true
  const randomIndex = Math.floor(Math.random() * quotes.length)
  currentQuote.value = quotes[randomIndex]
  setTimeout(() => { isAnimating.value = false }, 500)
}

onMounted(() => { randomize() })
</script>

<template>
  <div class="quote-container">
    <div class="quote-card" @click="randomize" :class="{ 'fade-in': isAnimating }">
      <div class="content-wrapper">
        <div class="main-text">“ {{ currentQuote.text }} ”</div>
        <div class="source-text">—— {{ currentQuote.source }}</div>
      </div>
      
      <div class="seal">每日<br>一语</div>
    </div>
    
    <div class="tip">点击卡片切换</div>
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

.tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  opacity: 0.5;
}

/* 切换动画 */
.fade-in .content-wrapper {
  animation: fadeIn 0.4s ease;
}
@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
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