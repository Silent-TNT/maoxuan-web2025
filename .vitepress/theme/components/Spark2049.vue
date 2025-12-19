<script setup>
import { ref } from 'vue'
import donors from '../../donors.json'

// --- 1. 时间计算逻辑 (保持不变) ---
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
  const delay = Math.random() * 3 + 's' 
  const size = 0.5 + Math.random() * 0.5 // 星星改小一点，更精致
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
        <p class="intro-text">
          这是一场跨越时空的数字长征<br>
          愿以星火之名，守此阵地至建国百年
        </p>
      </div>

      <div class="time-stats">
        <span>已运行 <span class="num">{{ daysRun }}</span> 天</span>
        <span class="divider">/</span>
        <span>距 2049 还需 <span class="num">{{ daysLeft }}</span> 天</span>
      </div>
      
      <div class="progress-container">
        <div class="progress-line-bg">
          <div class="progress-line-active" :style="{ width: progressPercent + '%' }">
            <div class="glowing-dot"></div> </div>
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
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: #000; /* 纯黑背景，更显深邃 */
  z-index: 200;
  color: #fff;
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* 极简返回键 */
.back-home {
  position: absolute; top: 24px; left: 24px;
  color: rgba(255,255,255,0.4);
  text-decoration: none;
  font-size: 14px;
  letter-spacing: 1px;
  transition: 0.3s;
  z-index: 300;
}
.back-home:hover { color: #fff; transform: translateX(-3px); }

/* 头部区域 */
.header-section {
  padding-top: 10vh; /* 稍微往下压一点 */
  text-align: center;
  position: relative;
  z-index: 10;
}

/* 标题：极细、大间距 */
.title {
  font-size: 2rem;
  font-weight: 200; /* 极细 */
  letter-spacing: 12px; /* 宽间距 */
  color: #fff;
  margin: 0 0 20px 0;
  opacity: 0.9;
  text-shadow: 0 0 20px rgba(210, 43, 43, 0.4); /* 红光晕 */
}

/* 文案：宋体、优雅 */
.intro-box {
  margin-bottom: 30px;
  padding: 0 20px;
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif; /* 宋体 */
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255,255,255,0.6);
  font-weight: 300;
}

/* 数据统计 */
.time-stats {
  font-size: 12px;
  color: #555;
  margin-bottom: 25px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.num { color: #d22b2b; font-family: monospace; font-size: 14px; margin: 0 3px; }
.divider { margin: 0 8px; color: #333; }

/* 极细进度条 */
.progress-container {
  width: 100%; display: flex; justify-content: center;
  margin-bottom: 40px;
}
.progress-line-bg {
  width: 280px; /* 短一点更精致 */
  height: 1px; /* 极细线 */
  background: rgba(255,255,255,0.1);
  position: relative;
}
.progress-line-active {
  height: 100%;
  background: #d22b2b;
  position: relative;
  box-shadow: 0 0 10px rgba(210,43,43,0.5);
}

/* 发光粒子替代 Emoji */
.glowing-dot {
  position: absolute;
  right: -2px; top: -2px;
  width: 5px; height: 5px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 8px #fff, 0 0 15px #d22b2b;
}

/* 磨砂玻璃按钮 */
.glass-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 30px;
  border-radius: 50px; /* 胶囊圆角 */
  background: rgba(255,255,255,0.03); /* 极淡背景 */
  border: 1px solid rgba(255,255,255,0.08); /* 极细边框 */
  backdrop-filter: blur(10px); /* 磨砂效果 */
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.4s ease;
  letter-spacing: 1px;
}
.glass-btn:hover {
  background: rgba(210, 43, 43, 0.1);
  border-color: rgba(210, 43, 43, 0.3);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0,0,0,0.5);
}

/* 星火区 */
.sparks-field {
  flex: 1;
  display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 50px;
  padding-bottom: 80px;
}
.spark-item { position: relative; width: 6px; height: 6px; cursor: pointer; }
.fire-core {
  width: 100%; height: 100%;
  background: #fff; border-radius: 50%;
  box-shadow: 0 0 4px #fff, 0 0 10px #d22b2b;
  opacity: 0.6;
  animation: breathe 4s infinite ease-in-out;
}
.spark-item:hover .fire-core { transform: scale(1.5); opacity: 1; background: #ffaaaa; }

/* 悬浮卡片微调 */
.spark-card {
  position: absolute; bottom: 20px; left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(0,0,0,0.8);
  border: 1px solid #222;
  padding: 8px 12px;
  border-radius: 4px;
  width: max-content;
  opacity: 0; visibility: hidden;
  transition: all 0.3s;
  pointer-events: none;
}
.spark-item:hover .spark-card { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.donor-name { font-size: 12px; color: #888; margin-bottom: 2px; }
.donor-msg { font-size: 13px; color: #eee; }

/* 弹窗 */
.qr-modal {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex; justify-content: center; align-items: center; z-index: 500;
  backdrop-filter: blur(5px);
}
.modal-content {
  background: #111; border: 1px solid #333;
  padding: 30px; border-radius: 12px; text-align: center;
}
.qr-img { width: 200px; margin: 20px 0; opacity: 0.9; border-radius: 8px; }
.close-btn {
  background: none; border: 1px solid #444; color: #666;
  padding: 6px 20px; border-radius: 20px; cursor: pointer; margin-top: 15px;
}
.close-btn:hover { border-color: #fff; color: #fff; }

@keyframes breathe { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

/* 移动端特殊优化 */
@media (max-width: 768px) {
  .title { font-size: 1.4rem; letter-spacing: 6px; }
  .intro-text { font-size: 13px; padding: 0 30px; } /* 增加内边距防止文字贴边 */
  .progress-line-bg { width: 200px; }
  .glass-btn { padding: 8px 24px; font-size: 12px; }
}
</style>