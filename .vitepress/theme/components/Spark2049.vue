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
const activeIndex = ref(-1)

const randomStyle = () => {
  const delay = Math.random() * 2 + 's'
  const size = 0.9 + Math.random() * 0.6 
  return { animationDelay: delay, transform: `scale(${size})` }
}

const toggleSpark = (index, event) => {
  event.stopPropagation()
  activeIndex.value = activeIndex.value === index ? -1 : index
}
const closeAll = () => activeIndex.value = -1
</script>

<template>
  <div class="spark-universe" @click="closeAll">
    <a href="/" class="back-home">
      <span class="arrow">←</span> 首页
    </a>

    <div class="header-section">
      <h1 class="title">星火计划</h1>
      
      <div class="intro-box">
        <p class="intro-text">愿景：将该站维护至 2049 年</p>
      </div>

      <div class="time-stats">
        <span class="stat-group">已运行 {{ daysRun }} 天</span>
        <span class="divider">/</span>
        <span class="stat-group">距建国百年还需 {{ daysLeft }} 天</span>
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
.spark-universe {
  position: fixed; top: 0; left: 0; width: 100vw; 
  height: 100vh; height: 100dvh; 
  background: #000;
  z-index: 200; color: #fff; display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.back-home {
  position: absolute; top: 20px; left: 20px; color: rgba(255,255,255,0.4);
  text-decoration: none; font-size: 13px; letter-spacing: 1px; transition: 0.3s; z-index: 300;
}
.back-home:hover { color: #fff; }

.header-section {
  padding-top: 15vh;
  width: 100%;
  display: flex; flex-direction: column; align-items: center; 
  position: relative; z-index: 10;
}

.title {
  font-size: 2.4rem; font-weight: 200; letter-spacing: 8px; color: #fff;
  margin: 0 0 15px 0;
  text-shadow: 0 0 30px rgba(255, 50, 50, 0.2); opacity: 0.95;
  text-align: center;
}

.intro-box { display: flex; justify-content: center; margin-bottom: 30px; }
.intro-text {
  font-family: "Songti SC", "SimSun", serif; font-size: 15px; letter-spacing: 2px;
  color: rgba(255,255,255,0.7); font-weight: 300; text-align: center;
}

.time-stats {
  font-size: 12px; color: #ccc; margin-bottom: 25px;
  letter-spacing: 1px; display: flex; justify-content: center; align-items: center;
}
.divider { margin: 0 10px; color: #444; }

.progress-container { width: 100%; display: flex; justify-content: center; margin-bottom: 35px; }
.progress-line-bg { width: 260px; height: 1px; background: rgba(255,255,255,0.15); position: relative; }
.progress-line-active { height: 100%; background: #fff; position: relative; box-shadow: 0 0 8px rgba(255,255,255,0.4); }
.glowing-dot {
  position: absolute; right: -2px; top: -2px; width: 5px; height: 5px; background: #fff; border-radius: 50%;
  box-shadow: 0 0 5px #fff, 0 0 10px #ff3333;
}

.glass-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 28px; border-radius: 50px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px); color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer; transition: all 0.4s ease; letter-spacing: 1px;
}
.glass-btn:hover { background: rgba(255, 50, 50, 0.15); border-color: rgba(255, 50, 50, 0.3); color: #fff; transform: translateY(-1px); }

.sparks-field {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 50px; 
  padding-bottom: calc(100px + env(safe-area-inset-bottom)); 
  perspective: 500px;
}
.spark-item { position: relative; width: 14px; height: 12px; cursor: pointer; }

.fire-core {
  width: 100%; height: 100%;
  border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%;
  background: radial-gradient(circle at center bottom, #fff 20%, #ffcc00 50%, #ff3300 80%, #660000 100%);
  box-shadow: 0 0 6px #ffaa00, 0 0 15px #ff4400, 0 0 30px rgba(210, 43, 43, 0.6);
  opacity: 1; animation: breathe 3s infinite ease-in-out alternate;
  position: relative; transition: transform 0.3s;
}
.fire-core::after {
  content: ''; position: absolute; top: -40%; left: 20%; width: 60%; height: 60%;
  background: radial-gradient(ellipse at center bottom, rgba(255,220,0,0.8) 0%, rgba(255,50,0,0) 70%);
  border-radius: 50% 50% 0 0; filter: blur(2px); opacity: 0.7; animation: rise 1.5s infinite linear;
}

.spark-item:hover .fire-core, .spark-item.is-active .fire-core { 
  transform: scale(1.4); box-shadow: 0 0 15px #fff, 0 0 30px #ff5500, 0 0 60px #ff0000;
}

@keyframes breathe { 0% { transform: scale(0.9); filter: brightness(0.9); } 100% { transform: scale(1.1); filter: brightness(1.2); } }
@keyframes rise { 0% { transform: translateY(0) scaleX(1); opacity: 0.5; } 100% { transform: translateY(-8px) scaleX(0.5); opacity: 0; } }

/* --- 核心优化：更精致的迷你卡片 --- */
.spark-card {
  position: absolute; 
  bottom: 45px; /* 稍微往上提一点 */
  left: 50%; transform: translateX(-50%) translateY(10px);
  background: rgba(20, 0, 0, 0.95); border: 1px solid #633;
  /* 减小内边距，更紧凑 */
  padding: 8px 12px; 
  border-radius: 6px; 
  width: max-content;
  max-width: 200px; /* 防止文字太长撑爆 */
  opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 50; pointer-events: none;
  backdrop-filter: blur(4px); /* 增加磨砂感 */
}
.spark-item:hover .spark-card, .spark-item.is-active .spark-card { 
  opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0);
}

/* 名字：极小，粉色辅助色 */
.donor-name { 
  font-size: 10px; /* 改小 */
  color: #eaa; 
  margin-bottom: 2px;
  opacity: 0.8;
}

/* 寄语：标准小字，清晰 */
.donor-msg { 
  font-size: 12px; /* 改小 */
  color: #fff; 
  font-family: "Songti SC", serif; 
  line-height: 1.4;
}

/* 弹窗 */
.qr-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 500; backdrop-filter: blur(5px); }
.modal-content { background: #111; border: 1px solid #333; padding: 30px; border-radius: 12px; text-align: center; }
.qr-img { width: 200px; margin: 20px 0; opacity: 0.9; border-radius: 8px; }
.close-btn { background: none; border: 1px solid #444; color: #666; padding: 6px 20px; border-radius: 20px; cursor: pointer; margin-top: 15px; }
.close-btn:hover { border-color: #fff; color: #fff; }

@media (max-width: 768px) {
  .header-section { padding-top: 18vh; }
  .title { font-size: 1.8rem; letter-spacing: 5px; }
  .intro-text { font-size: 14px; }
  .progress-line-bg { width: 200px; }
  .intro-box, .time-stats, .progress-container, .action-area { display: flex; justify-content: center; }
}
</style>