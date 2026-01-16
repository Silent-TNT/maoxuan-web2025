<script setup>
import { ref, onMounted } from 'vue'
import { quotes } from '../../data/quotes.js'

const currentQuote = ref({ text: '', source: '' })
const isAnimating = ref(false)

// 随机抽取一条
const randomize = () => {
  isAnimating.value = true
  // 简单的随机算法
  const randomIndex = Math.floor(Math.random() * quotes.length)
  currentQuote.value = quotes[randomIndex]
  
  // 动画复位
  setTimeout(() => {
    isAnimating.value = false
  }, 500)
}

onMounted(() => {
  randomize()
})
</script>

<template>
  <div class="quote-container">
    <div class="quote-card" @click="randomize" :class="{ 'fade-in': isAnimating }">
      <div class="border-inner"></div>
      
      <div class="content-wrapper">
        <div class="vertical-text main-text">
          {{ currentQuote.text }}
        </div>
        <div class="vertical-text source-text">
          {{ currentQuote.source }}
        </div>
      </div>
      
      <div class="seal">
        <span>每日<br>一语</span>
      </div>
    </div>
    
    <div class="tip">点击卡片切换内容</div>
  </div>
</template>

<style scoped>
.quote-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px; /* 距离上方按钮的距离 */
  margin-bottom: 60px;
}

.quote-card {
  position: relative;
  /* 竖排容器需要固定高度，宽度自适应 */
  height: 280px; 
  min-width: 160px;
  max-width: 90%;
  padding: 30px 50px;
  
  /* 🔴 核心样式：红色边框 + 古籍风格 */
  border: 3px double #d22b2b; /* 双线边框，更有古风感 */
  background-color: rgba(255, 255, 255, 0.03); /* 极淡的背景 */
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  user-select: none;
  
  /* 布局居中 */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 悬停效果：浮起 */
.quote-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(210, 43, 43, 0.15);
  background-color: rgba(210, 43, 43, 0.05);
}

.content-wrapper {
  display: flex;
  flex-direction: row-reverse; /* 竖排是从右向左读，所以要反转flex方向 */
  gap: 20px;
}

/* 📜 核心黑科技：竖排文字 */
.vertical-text {
  writing-mode: vertical-rl; /* 垂直书写，从右向左 */
  font-family: "Songti SC", "SimSun", "STSong", serif; /* 必须用宋体！ */
  letter-spacing: 4px;
}

.main-text {
  font-size: 24px;
  font-weight: bold;
  color: var(--vp-c-text-1);
  line-height: 1.5;
}

.source-text {
  font-size: 14px;
  color: #d22b2b; /* 来源用红色 */
  opacity: 0.8;
  align-self: flex-end; /* 底部对齐 */
  margin-bottom: 10px;
}

/* 纯CSS写的印章 */
.seal {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 36px;
  height: 36px;
  border: 2px solid #d22b2b;
  border-radius: 4px;
  color: #d22b2b;
  font-size: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 1.1;
  text-align: center;
  font-family: "Songti SC", serif;
  opacity: 0.6;
  transform: rotate(-10deg); /* 稍微歪一点，像真盖上去的 */
}

.tip {
  margin-top: 15px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  opacity: 0.6;
}

/* 切换动画 */
.fade-in .vertical-text {
  animation: fadeInText 0.5s ease;
}

@keyframes fadeInText {
  0% { opacity: 0; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* 移动端适配 */
@media (max-width: 600px) {
  .quote-card {
    height: 220px; /* 手机上稍微矮一点 */
    padding: 20px 30px;
  }
  .main-text { font-size: 20px; }
}
</style>