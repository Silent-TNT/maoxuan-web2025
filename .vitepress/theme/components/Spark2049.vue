<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import donors from '../../donors.json'

// --- 1. 时间计算逻辑 ---
const startDate = new Date('2025-12-19')
const targetDate = new Date('2049-10-01')
const today = new Date()
const daysRun = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))
const totalDuration = targetDate - startDate
const currentDuration = today - startDate
const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)

// --- 2. 交互逻辑 ---
const showQR = ref(false)
const activeIndex = ref(-1) // 记录当前被点击激活的火种索引

// 随机样式
const randomStyle = () => {
  const delay = Math.random() * 2 + 's'
  const size = 0.8 + Math.random() * 0.5 
  return { animationDelay: delay, transform: `scale(${size})` }
}

// 手机端交互：点击切换寄语显示/隐藏
const toggleSpark = (index, event) => {
  // 阻止冒泡，防止触发背景关闭
  event.stopPropagation()
  if (activeIndex.value === index) {
    activeIndex.value = -1 // 如果点的是同一个，就关闭
  } else {
    activeIndex.value = index // 否则打开新的
  }
}

// 点击背景空白处，关闭所有寄语
const closeAll = () => {
  activeIndex.value = -1
}
</script>

<template>
  <div class="spark-universe" @click="closeAll">
    <a href="/" class="back-home">
      <span class="arrow">←</span> 首页
    </a>

    <div class="header-section">
      <h1 class="title">星火计划 2049</h1>
      
      <div class="intro-box">
        <p class="intro-text">愿景：将该站维护至 2049 年</p>
      </div>

      <div class="time-stats">
        <span class="stat-group">已运行 {{ daysRun }} 天</span>
        <span class="divider">/</span>
        <span class="stat-group">距 2049 还需 {{ daysLeft }} 天</span>
      </div>
      
      <div class="progress-container">
        <div class="progress-line-bg">
          <div class="progress-line-active" :style="{ width: progressPercent + '%' }">
            <div class="glowing-dot"></div>
          </div>
        </div>
      </div>

      <div class="action-area">
        <div class="glass-btn" @click.stop="showQR = true">
          <span class="plus">+</span> 汇入火种
        </div>
      </div>
    </div>

    <div class="sparks-field">
      <div 
        v-for="(donor, index) in donors" 
        :key="index"
        class="spark-item"
        :class="{ 'is-active': activeIndex === index }" 
        :style="randomStyle()"
        @click="(e) => toggleSpark(index, e)"
      >
        <div class="fire-core">
          <div class="flame-tip"></div>
        </div>
        
        <div class="spark-card" @click.stop>
          <div class="donor-name">@{{ donor.name }}</div>
          <div class="donor-msg">“{{ donor.message }}”</div>
        </div>
      </div>
    </div>

    <div v-if="showQR" class="qr-modal" @click.stop="showQR = false">
      <div class="modal-content" @click.stop>
        <h3>注入火种</h3>
        <img src="/wechat-pay.jpg" alt="捐赠二维码" class="qr-img">
        <p style="color:#888; font-size: 13px;">请备注【昵称 + 寄语】</p>
        <button class="close-btn" @click="showQR = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础样式保持不变 */
.spark-universe {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: #000;
  z-index: 200; color: #fff; display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* 解决移动端点击高亮背景色问题 */
  -webkit-tap-highlight-color: transparent;
}

.back-home {
  position: absolute; top: 20px; left: 20px; color: rgba(255,255,255,0.4);
  text-decoration: none; font-size: 13px; letter-spacing: 1px; transition: 0.3s; z-index: 300;
}
.back-home:hover { color: #fff; }

.header-section {
  padding-top: 10vh; text-align: center; position: relative; z-index: 10; width: 100%;
}

.title {
  font-size: 2rem; font-weight: 200; letter-spacing: 10px; color: #fff;
  margin: 0 0 15px 0;
  text-shadow: 0 0 30px rgba(255, 50, 50, 0.2); opacity: 0.9;
}

.intro-box {
  width: 100%; display: flex; justify-content: center; margin-bottom: 20px;
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif; font-size: 15px; letter-spacing: 2px;
  color: rgba(255,255,255,0.6); font-weight: 300;
  border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;
}

/* --- 核心修复：文字颜色优化 --- */
.time-stats {
  font-size: 12px;
  /* 改为清晰的亮银色，不再暗淡 */
  color: #ccc; 
  margin-bottom: 20px;
  letter-spacing: 1px; text-transform: uppercase;
  display: flex; justify-content: center; align-items: center;
  /* 移除 opacity 属性，保证清晰度 */
}
/* 数字样式重置：和文字保持一致，不加粗，不高亮 */
.stat-group {
  font-weight: 300;
}
.divider { margin: 0 10px; color: #444; }

.progress-container {
  width: 100%; display: flex; justify-content: center; margin-bottom: 30px;
}
.progress-line-bg {
  width: 240px; height: 1px; background: rgba(255,255,255,0.1); position: relative;
}
.progress-line-active {
  height: 100%; background: #fff; position: relative; box-shadow: 0 0 8px rgba(255,255,255,0.3);
}
.glowing-dot {
  position: absolute; right: -2px; top: -2px; width: 5px; height: 5px; background: #fff; border-radius: 50%;
  box-shadow: 0 0 5px #fff, 0 0 10px #ff3333;
}

.glass-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 24px; border-radius: 50px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(10px); color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer; transition: all 0.4s ease; letter-spacing: 1px;
}
.glass-btn:hover {
  background: rgba(255, 50, 50, 0.1); border-color: rgba(255, 50, 50, 0.3); color: #fff; transform: translateY(-1px);
}

/* 星火区 */
.sparks-field {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 60px; padding-bottom: 100px; perspective: 500px;
}
.spark-item { position: relative; width: 12px; height: 10px; cursor: pointer; }

.fire-core {
  width: 100%; height: 100%;
  border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%;
  background: radial-gradient(circle at center bottom, #fff 10%, #ffcc00 30%, #ff3300 60%, #660000 100%);
  box-shadow: 0 0 5px #ffaa00, 0 0 15px #ff3300, 0 0 30px rgba(210, 43, 43, 0.8), inset 0 -2px 5px rgba(0,0,0,0.5);
  opacity: 0.8;
  animation: breathe 3s infinite ease-in-out alternate;
  position: relative;
  transition: transform 0.3s;
}

.fire-core::after {
  content: ''; position: absolute; top: -40%; left: 20%; width: 60%; height: 60%;
  background: radial-gradient(ellipse at center bottom, rgba(255,200,0,0.8) 0%, rgba(255,50,0,0) 70%);
  border-radius: 50% 50% 0 0; filter: blur(2px); opacity: 0.6; animation: rise 1.5s infinite linear;
}

/* 交互状态：悬浮 OR 被点击激活(手机) */
.spark-item:hover .fire-core,
.spark-item.is-active .fire-core { 
  transform: scale(1.4); opacity: 1;
  background: radial-gradient(circle at center bottom, #fff 20%, #ffdd33 40%, #ff4400 70%, #880000 100%);
  box-shadow: 0 0 10px #fff, 0 0 25px #ff5500, 0 0 50px #ff0000;
}

@keyframes breathe { 0% { transform: scale(0.95); opacity: 0.7; filter: brightness(0.8); } 100% { transform: scale(1.05); opacity: 1; filter: brightness(1.2); } }
@keyframes rise { 0% { transform: translateY(0) scaleX(1); opacity: 0.5; } 50% { transform: translateY(-3px) scaleX(0.8); opacity: 0.8; } 100% { transform: translateY(-6px) scaleX(0.6); opacity: 0; } }

/* 卡片调整 */
.spark-card {
  position: absolute; bottom: 35px; left: 50%; transform: translateX(-50%) translateY(10px);
  background: rgba(20, 0, 0, 0.95); /* 背景加深 */
  border: 1px solid #522; /* 边框微红 */
  padding: 10px 14px; border-radius: 4px; width: max-content;
  
  /* 默认隐藏 */
  opacity: 0; visibility: hidden; 
  transition: all 0.3s; z-index: 50;
  pointer-events: none; /* 防止遮挡点击 */
}

/* 触发显示：悬浮 OR 激活类名 */
.spark-item:hover .spark-card,
.spark-item.is-active .spark-card { 
  opacity: 1; visibility: visible; 
  transform: translateX(-50%) translateY(0);
}

.donor-name { font-size: 12px; color: #d88; margin-bottom: 3px; }
.donor-msg { font-size: 14px; color: #fff; font-family: "Songti SC", serif; }

.qr-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 500; backdrop-filter: blur(5px); }
.modal-content { background: #111; border: 1px solid #333; padding: 30px; border-radius: 12px; text-align: center; }
.qr-img { width: 200px; margin: 20px 0; opacity: 0.9; border-radius: 8px; }
.close-btn { background: none; border: 1px solid #444; color: #666; padding: 6px 20px; border-radius: 20px; cursor: pointer; margin-top: 15px; }
.close-btn:hover { border-color: #fff; color: #fff; }

@media (max-width: 768px) {
  .header-section { padding-top: 12vh; }
  .title { font-size: 1.5rem; letter-spacing: 6px; margin-bottom: 10px; }
  .intro-text { font-size: 13px; }
  .time-stats { font-size: 12px; margin-bottom: 15px; }
  .progress-line-bg { width: 180px; }
  .glass-btn { padding: 6px 20px; font-size: 11px; }
  .sparks-field { gap: 40px; padding-bottom: 80px; }
}
</style>