<script setup>
import { ref } from 'vue'
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
const randomStyle = () => {
  const delay = Math.random() * 2 + 's' // 加快一点闪烁频率
  const size = 0.6 + Math.random() * 0.6 // 稍微调大一点火种
  return { animationDelay: delay, transform: `scale(${size})` }
}
</script>

<template>
  <div class="spark-universe">
    <a href="/" class="back-home">
      <span class="arrow">←</span> 首页
    </a>

    <div class="header-section">
      <h1 class="title">星火计划 2049</h1>
      
      <div class="intro-box">
        <p class="intro-text">愿景：将该站维护至 2049 年</p>
      </div>

      <div class="time-stats">
        <span>已运行 <span class="num">{{ daysRun }}</span> 天</span>
        <span class="divider">/</span>
        <span>距 2049 还需 <span class="num">{{ daysLeft }}</span> 天</span>
      </div>
      
      <div class="progress-container">
        <div class="progress-line-bg">
          <div class="progress-line-active" :style="{ width: progressPercent + '%' }">
            <div class="glowing-dot"></div>
          </div>
        </div>
      </div>

      <div class="action-area">
        <div class="glass-btn" @click="showQR = true">
          <span class="plus">+</span> 汇入火种
        </div>
      </div>
    </div>

    <div class="sparks-field">
      <div 
        v-for="(donor, index) in donors" 
        :key="index"
        class="spark-item"
        :style="randomStyle()"
      >
        <div class="fire-core"></div>
        <div class="spark-card">
          <div class="donor-name">@{{ donor.name }}</div>
          <div class="donor-msg">“{{ donor.message }}”</div>
        </div>
      </div>
    </div>

    <div v-if="showQR" class="qr-modal" @click.self="showQR = false">
      <div class="modal-content">
        <h3>注入火种</h3>
        <img src="/wechat-pay.jpg" alt="捐赠二维码" class="qr-img">
        <p style="color:#888; font-size: 13px;">请备注【昵称 + 寄语】</p>
        <button class="close-btn" @click="showQR = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全屏容器 */
.spark-universe {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: #000; /* 极致黑 */
  z-index: 200;
  color: #fff;
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.back-home {
  position: absolute; top: 24px; left: 24px;
  color: rgba(255,255,255,0.3);
  text-decoration: none; font-size: 14px; letter-spacing: 1px; transition: 0.3s; z-index: 300;
}
.back-home:hover { color: #fff; }

/* 头部区域 */
.header-section {
  padding-top: 12vh;
  text-align: center;
  position: relative;
  z-index: 10;
  width: 100%;
}

/* 标题 */
.title {
  font-size: 2.2rem;
  font-weight: 200;
  letter-spacing: 12px;
  color: #fff;
  margin: 0 0 25px 0;
  text-shadow: 0 0 30px rgba(255, 50, 50, 0.3); /* 淡淡的红晕 */
}

/* 文案优化：居中、宋体、更亮一点 */
.intro-box {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif;
  font-size: 16px;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.8);
  font-weight: 300;
  border-bottom: 1px solid rgba(255,255,255,0.1); /* 加个极细下划线增加仪式感 */
  padding-bottom: 10px;
}

/* 数据统计：去掉红色，改为纯白 */
.time-stats {
  font-size: 12px;
  color: #666; /* 标签文字暗下去 */
  margin-bottom: 25px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.num { 
  color: #fff; /* 数字改为纯白 */
  font-family: monospace; 
  font-size: 15px; 
  font-weight: bold;
  margin: 0 4px; 
  text-shadow: 0 0 10px rgba(255,255,255,0.3); /* 数字微光 */
}
.divider { margin: 0 8px; color: #333; }

/* 进度条 */
.progress-container {
  width: 100%; display: flex; justify-content: center; margin-bottom: 45px;
}
.progress-line-bg {
  width: 280px; height: 1px; background: rgba(255,255,255,0.15); position: relative;
}
.progress-line-active {
  height: 100%; background: #fff; position: relative;
  box-shadow: 0 0 10px rgba(255,255,255,0.5);
}
.glowing-dot {
  position: absolute; right: -2px; top: -2px;
  width: 5px; height: 5px; background: #fff; border-radius: 50%;
  /* 进度条的头也加红光 */
  box-shadow: 0 0 5px #fff, 0 0 15px #ff0000; 
}

/* 按钮 */
.glass-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 32px;
  border-radius: 50px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  color: rgba(255,255,255,0.8);
  font-size: 13px; cursor: pointer; transition: all 0.4s ease; letter-spacing: 1px;
}
.glass-btn:hover {
  background: rgba(255, 50, 50, 0.15); /* 悬浮微微泛红 */
  border-color: rgba(255, 50, 50, 0.4);
  color: #fff; transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0,0,0,0.6);
}

/* --- 核心优化：星火特效 --- */
.sparks-field {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 60px; padding-bottom: 100px;
}
.spark-item { position: relative; width: 8px; height: 8px; cursor: pointer; }

.fire-core {
  width: 100%; height: 100%;
  border-radius: 50%;
  /* 核心是白的(高温)，外圈是红的，最外圈是深红光晕 */
  background: #fff; 
  box-shadow: 
    0 0 4px #fff,          /* 核心光 */
    0 0 15px #ff3333,      /* 中层红光 */
    0 0 30px #d22b2b,      /* 外层红晕 */
    0 0 50px rgba(255,0,0,0.5); /* 氛围散光 */
  opacity: 0.8;
  animation: breathe 3s infinite ease-in-out;
}

/* 悬浮时火光爆燃 */
.spark-item:hover .fire-core { 
  transform: scale(1.6); 
  opacity: 1; 
  background: #ffecec;
  box-shadow: 0 0 10px #fff, 0 0 30px #ff0000, 0 0 60px #ff0000;
}

/* 呼吸动画：模拟真实火炭的明暗 */
@keyframes breathe { 
  0%,100% { transform: scale(0.9); opacity: 0.6; box-shadow: 0 0 10px #ff3333, 0 0 20px #d22b2b; } 
  50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 15px #ff5555, 0 0 35px #ff0000; } 
}

/* 悬浮卡片 */
.spark-card {
  position: absolute; bottom: 30px; left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(10, 10, 10, 0.95);
  border: 1px solid #333; padding: 10px 14px; border-radius: 4px;
  width: max-content; opacity: 0; visibility: hidden; transition: all 0.3s; pointer-events: none;
  z-index: 50;
}
.spark-item:hover .spark-card { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.donor-name { font-size: 12px; color: #888; margin-bottom: 3px; }
.donor-msg { font-size: 14px; color: #fff; font-family: "Songti SC", serif; }

/* 弹窗 */
.qr-modal {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 500;
  backdrop-filter: blur(5px);
}
.modal-content {
  background: #111; border: 1px solid #333; padding: 30px; border-radius: 12px; text-align: center;
}
.qr-img { width: 200px; margin: 20px 0; opacity: 0.9; border-radius: 8px; }
.close-btn {
  background: none; border: 1px solid #444; color: #666; padding: 6px 20px; border-radius: 20px; cursor: pointer; margin-top: 15px;
}
.close-btn:hover { border-color: #fff; color: #fff; }

@media (max-width: 768px) {
  .title { font-size: 1.6rem; letter-spacing: 8px; }
  .intro-text { font-size: 14px; }
  .progress-line-bg { width: 220px; }
  .sparks-field { gap: 40px; }
}
</style>