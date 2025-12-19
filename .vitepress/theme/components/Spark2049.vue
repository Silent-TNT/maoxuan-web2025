<script setup>
import { ref } from 'vue'
import donors from '../../donors.json'

// --- 1. 时间计算逻辑 ---
// 修正起始时间为 2025-12-19
const startDate = new Date('2025-12-19')
const targetDate = new Date('2049-10-01')
const today = new Date()

// 计算天数（向上取整，避免显示 -1 天）
const daysRun = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))

// 计算进度条百分比
const totalDuration = targetDate - startDate
const currentDuration = today - startDate
const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)

// --- 2. 交互逻辑 ---
const showQR = ref(false) // 控制二维码弹窗

// 生成随机位置（模拟漫天星火的错落感）
const randomStyle = () => {
  const delay = Math.random() * 3 + 's' 
  // 随机大小，营造远近感
  const size = 0.8 + Math.random() * 0.6 
  return {
    animationDelay: delay,
    transform: `scale(${size})`
  }
}
</script>

<template>
  <div class="spark-universe">
    <a href="/" class="back-home">
      <span class="arrow">←</span> 返回首页
    </a>

    <div class="header-section">
      <h1 class="title">星火计划 2049</h1>
      
      <p class="intro-text">
        愿景：将此站维护至建国百年。这是一场跨越时空的数字长征，<br>
        您的名字将化作星火，在此永存，共同见证燎原之时。
      </p>

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

      <div class="action-area">
        <div class="join-btn" @click="showQR = true">
          <span class="plus">+</span> 等待更多火种汇入
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
        <p>赞赏时请备注【昵称 + 寄语】</p>
        <p class="sub-text">或支付后邮件联系上墙</p>
        <button class="close-btn" @click="showQR = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全屏容器 */
.spark-universe {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* 背景优化：更深邃的黑 */
  background: radial-gradient(circle at center bottom, #1b1b1b 0%, #000000 100%);
  z-index: 200; /* 确保盖住导航栏 */
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 返回首页按钮 */
.back-home {
  position: absolute;
  top: 20px;
  left: 20px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  transition: all 0.3s;
  z-index: 300;
}
.back-home:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-color: rgba(255,255,255,0.4);
}
.arrow { margin-right: 5px; font-weight: bold; }

/* 头部区域 */
.header-section {
  padding-top: 80px; /* 留出顶部空间 */
  text-align: center;
  position: relative;
  z-index: 10;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); /* 顶部渐变遮罩 */
  padding-bottom: 20px;
}

.title {
  font-size: 2.8rem;
  font-weight: 900;
  letter-spacing: 6px;
  /* 标题渐变色优化：红金渐变 */
  background: linear-gradient(to right, #ff3333, #ffcc33);
  -webkit-background-clip: text;
  color: transparent;
  margin: 0;
  text-shadow: 0 5px 15px rgba(210, 43, 43, 0.3);
}

.intro-text {
  font-size: 15px;
  color: #aaa;
  line-height: 1.6;
  margin: 20px auto;
  max-width: 600px;
  font-weight: 300;
}

.time-stats {
  font-size: 13px;
  color: #666;
  margin-bottom: 15px;
  font-family: monospace; /* 等宽字体显示数字更有科技感 */
}
.time-stats strong { color: #d22b2b; font-size: 16px; margin: 0 4px; }
.divider { margin: 0 10px; opacity: 0.2; }

/* 进度条 */
.progress-bar-bg {
  width: 90%;
  max-width: 700px;
  height: 2px; /* 极细线，更精致 */
  background: rgba(255,255,255,0.1);
  margin: 0 auto 30px auto;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: #d22b2b;
  position: relative;
  box-shadow: 0 0 8px #d22b2b;
}

.spark-head {
  position: absolute;
  right: -8px;
  top: -11px;
  font-size: 16px;
}

/* 按钮区域 */
.action-area {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.join-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px; /* 稍微方一点，更严肃 */
  color: #ccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  /* 去掉了之前的 float 动画，现在是静止的 */
}

.join-btn:hover {
  background: rgba(210, 43, 43, 0.15);
  border-color: #d22b2b;
  color: #fff;
  box-shadow: 0 0 20px rgba(210, 43, 43, 0.2);
}

/* 星火区域 */
.sparks-field {
  flex: 1; /* 占满剩余高度 */
  display: flex;
  align-items: flex-end; /* 星火沉底 */
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px; /* 间距拉大 */
  padding: 0 40px 80px 40px;
  perspective: 1000px; /* 增加一点3D透视感 */
}

.spark-item {
  position: relative;
  width: 8px;
  height: 8px;
  cursor: pointer;
}

.fire-core {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 50%;
  /* 火光更强烈 */
  box-shadow: 0 0 8px #ffaa00, 0 0 15px #ff3333;
  opacity: 0.8;
  animation: flicker 4s infinite alternate ease-in-out;
}

.spark-item:hover .fire-core {
  transform: scale(2);
  background: #ffcc00;
  box-shadow: 0 0 20px #ffaa00, 0 0 40px #ff3333;
  opacity: 1;
}

/* 卡片样式 */
.spark-card {
  position: absolute;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(10, 10, 10, 0.95);
  border: 1px solid #333;
  padding: 12px 16px;
  border-radius: 6px;
  width: max-content;
  max-width: 200px;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 20;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}
.spark-item:hover .spark-card {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.donor-name { color: #ff6b6b; font-size: 12px; margin-bottom: 4px; letter-spacing: 1px; }
.donor-msg { color: #fff; font-size: 14px; font-weight: bold; }

/* 弹窗 */
.qr-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 500;
}
.modal-content {
  background: #111;
  border: 1px solid #333;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 0 50px rgba(0,0,0,1);
}
.qr-img { width: 220px; border-radius: 8px; margin: 20px 0; opacity: 0.9; }
.close-btn {
  margin-top: 20px;
  background: transparent;
  border: 1px solid #444;
  color: #666;
  padding: 6px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: 0.2s;
}
.close-btn:hover { border-color: #fff; color: #fff; }

@keyframes flicker {
  0% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 0.8; transform: scale(1.0); }
  100% { opacity: 1; transform: scale(1.1); }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .title { font-size: 1.8rem; }
  .intro-text { font-size: 13px; padding: 0 20px; }
  .progress-bar-bg { width: 85%; }
  .back-home { top: 15px; left: 15px; font-size: 12px; padding: 6px 12px; }
}
</style>