<script setup>
import { ref, onMounted } from 'vue'
import donors from '../../donors.json'

// --- 1. 时间计算逻辑 ---
const startDate = new Date('2025-12-20') // 建站日期（你可以改成今天）
const targetDate = new Date('2049-10-01') // 目标：建国百年
const today = ref(new Date())

// 计算天数
const daysRun = Math.floor((today.value - startDate) / (1000 * 60 * 60 * 24))
const daysLeft = Math.ceil((targetDate - today.value) / (1000 * 60 * 60 * 24))

// 计算进度条百分比
const totalDuration = targetDate - startDate
const currentDuration = today.value - startDate
const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)

// --- 2. 交互逻辑 ---
const showQR = ref(false) // 控制二维码弹窗

// 生成随机位置（模拟漫天星火的错落感）
const randomStyle = () => {
  const delay = Math.random() * 3 + 's' // 随机呼吸延迟
  // 简单的错落布局，如果你想要完全随机分布，需要更复杂的JS
  return {
    animationDelay: delay
  }
}
</script>

<template>
  <div class="spark-universe">
    <div class="progress-section">
      <h1 class="title">星火计划 2049</h1>
      <div class="time-stats">
        <span>已运行 <strong>{{ daysRun }}</strong> 天</span>
        <span class="divider">/</span>
        <span>距建国百年还需坚持 <strong>{{ daysLeft }}</strong> 天</span>
      </div>
      
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }">
          <div class="spark-head">🔥</div>
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
        <div class="fire-glow"></div>
        <div class="spark-card">
          <div class="donor-name">@{{ donor.name }}</div>
          <div class="donor-msg">“{{ donor.message }}”</div>
        </div>
      </div>

      <div class="join-btn" @click="showQR = true">
        <span class="plus">+</span>
        <span class="text">等待更多火种汇入</span>
      </div>
    </div>

    <div v-if="showQR" class="qr-modal" @click.self="showQR = false">
      <div class="modal-content">
        <h3>注入火种</h3>
        <img src="/wechat-pay.jpg" alt="捐赠二维码" class="qr-img">
        <p>赞赏时请备注【昵称 + 寄语】</p>
        <p class="sub-text">或支付后邮件联系</p>
        <button class="close-btn" @click="showQR = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全屏霸占样式 */
.spark-universe {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at bottom, #1b0a0a 0%, #000000 100%);
  z-index: 100; /* 覆盖在所有内容之上 */
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 20px;
  box-sizing: border-box;
  overflow: hidden;
}

/* 顶部进度区 */
.progress-section {
  text-align: center;
  z-index: 2;
  margin-top: 60px; /* 避开顶栏(如果有) */
}

.title {
  font-size: 2.5rem;
  font-weight: bold;
  letter-spacing: 4px;
  background: linear-gradient(to right, #ff4d4d, #ff9e9e);
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 20px;
}

.time-stats {
  font-size: 14px;
  color: #888;
  margin-bottom: 15px;
}
.time-stats strong { color: #d22b2b; font-size: 18px; margin: 0 4px; }
.divider { margin: 0 10px; opacity: 0.3; }

.progress-bar-bg {
  width: 100%;
  max-width: 800px;
  height: 4px;
  background: rgba(255,255,255,0.1);
  margin: 0 auto;
  border-radius: 2px;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: #d22b2b;
  position: relative;
  box-shadow: 0 0 10px #d22b2b;
}

.spark-head {
  position: absolute;
  right: -10px;
  top: -12px;
  font-size: 20px;
  filter: drop-shadow(0 0 5px #ff4d4d);
}

/* 底部火种区 */
.sparks-field {
  flex: 1;
  display: flex;
  align-items: flex-end; /* 沉底 */
  justify-content: center;
  flex-wrap: wrap;
  gap: 30px;
  padding-bottom: 60px;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

/* 单个火种 */
.spark-item {
  position: relative;
  width: 10px;
  height: 10px;
  cursor: pointer;
}

/* 火光核心 */
.fire-core {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 10px #ffaa00, 0 0 20px #ff4d4d;
  animation: flicker 3s infinite alternate;
}

/* 悬停卡片 */
.spark-card {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  background: rgba(20, 20, 20, 0.9);
  border: 1px solid #333;
  padding: 10px 15px;
  border-radius: 8px;
  width: 180px;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.spark-item:hover .spark-card {
  opacity: 1;
  visibility: visible;
  bottom: 30px;
  transform: translateX(-50%) scale(1);
}

.spark-item:hover .fire-core {
  transform: scale(1.5);
  box-shadow: 0 0 20px #ffaa00, 0 0 40px #ff4d4d;
}

.donor-name { color: #ff9e9e; font-size: 12px; margin-bottom: 4px; }
.donor-msg { color: #fff; font-size: 14px; font-weight: bold; }

/* 汇入按钮 */
.join-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s;
  margin-left: 20px;
  margin-bottom: -5px; /* 对齐微调 */
  animation: float 4s infinite ease-in-out;
}

.join-btn:hover {
  background: rgba(210, 43, 43, 0.2);
  border-color: #d22b2b;
  box-shadow: 0 0 15px rgba(210, 43, 43, 0.3);
}

/* 弹窗样式 */
.qr-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  animation: fadeIn 0.3s;
}

.modal-content {
  background: #1a1a1a;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #333;
  box-shadow: 0 20px 50px rgba(0,0,0,0.7);
  max-width: 90%;
}

.qr-img { width: 250px; border-radius: 8px; margin: 15px 0; }
.sub-text { font-size: 12px; color: #666; margin-top: 5px; }
.close-btn {
  margin-top: 20px;
  background: transparent;
  border: 1px solid #444;
  color: #888;
  padding: 6px 20px;
  border-radius: 4px;
  cursor: pointer;
}
.close-btn:hover { border-color: #fff; color: #fff; }

/* 动画定义 */
@keyframes flicker {
  0% { opacity: 0.6; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1.1); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>