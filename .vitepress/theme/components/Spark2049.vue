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
  const delay = Math.random() * 2 + 's'
  // 稍微调大基础尺寸，因为现在是复杂的形状了
  const size = 0.8 + Math.random() * 0.5 
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
        <span class="stat-group">已运行 <span class="num">{{ daysRun }}</span> 天</span>
        <span class="divider">/</span>
        <span class="stat-group">距 2049 还需 <span class="num">{{ daysLeft }}</span> 天</span>
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
        <div class="fire-core">
          <div class="flame-tip"></div>
        </div>
        
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
  background: #000;
  z-index: 200; color: #fff; display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.back-home {
  position: absolute; top: 20px; left: 20px; color: rgba(255,255,255,0.3);
  text-decoration: none; font-size: 13px; letter-spacing: 1px; transition: 0.3s; z-index: 300;
}
.back-home:hover { color: #fff; }

/* --- 头部区域：全面紧凑化 --- */
.header-section {
  padding-top: 10vh; /* 整体上移 */
  text-align: center; position: relative; z-index: 10; width: 100%;
}

/* 标题：字号微调，间距压缩 */
.title {
  font-size: 2rem; font-weight: 200; letter-spacing: 10px; color: #fff;
  margin: 0 0 15px 0; /* 压缩下边距 */
  text-shadow: 0 0 30px rgba(255, 50, 50, 0.2);
  opacity: 0.9;
}

/* 文案：间距压缩 */
.intro-box {
  width: 100%; display: flex; justify-content: center;
  margin-bottom: 20px; /* 压缩下边距 */
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif; font-size: 15px; letter-spacing: 2px;
  color: rgba(255,255,255,0.6); /* 降低亮度，弱化 */
  font-weight: 300;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 8px;
}

/* 数据统计：极大弱化 */
.time-stats {
  font-size: 12px; color: #444; /* 变得很暗 */
  margin-bottom: 20px; /* 压缩下边距 */
  letter-spacing: 1px; text-transform: uppercase;
  display: flex; justify-content: center; align-items: center;
  opacity: 0.7; /* 整体透明度降低 */
}
.num { 
  color: #bbb; /* 数字不再是纯白，而是灰白 */
  font-family: monospace; font-size: 14px; font-weight: normal; margin: 0 4px; 
}
.divider { margin: 0 10px; color: #222; }

/* 进度条：更细 */
.progress-container {
  width: 100%; display: flex; justify-content: center; margin-bottom: 30px; /* 压缩下边距 */
}
.progress-line-bg {
  width: 240px; /* 变短 */
  height: 1px; background: rgba(255,255,255,0.1); position: relative;
}
.progress-line-active {
  height: 100%; background: #fff; position: relative;
  box-shadow: 0 0 8px rgba(255,255,255,0.3);
}
.glowing-dot {
  position: absolute; right: -2px; top: -2px; width: 5px; height: 5px; background: #fff; border-radius: 50%;
  box-shadow: 0 0 5px #fff, 0 0 10px #ff3333;
}

/* 按钮：更小巧精致 */
.glass-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 24px; /* 缩小内边距 */
  border-radius: 50px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(10px); color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer; transition: all 0.4s ease; letter-spacing: 1px;
}
.glass-btn:hover {
  background: rgba(255, 50, 50, 0.1); border-color: rgba(255, 50, 50, 0.3);
  color: #fff; transform: translateY(-1px);
}

/* --- 底部核心优化：具象化星火 --- */
.sparks-field {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 60px; padding-bottom: 100px;
  perspective: 500px; /* 增加一点透视感 */
}
/* 基础容器调大一点，容纳复杂的火种 */
.spark-item { position: relative; width: 12px; height: 10px; cursor: pointer; }

/* 具象化的余烬核心 */
.fire-core {
  width: 100%; height: 100%;
  /* 形状：不再是正圆，而是底部圆润、顶部略平的余烬形状 */
  border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%;
  /* 材质感：核心白热 -> 中间黄橙 -> 边缘红 -> 外圈暗红 */
  background: radial-gradient(circle at center bottom, #fff 10%, #ffcc00 30%, #ff3300 60%, #660000 100%);
  /* 光晕层：多重红光 */
  box-shadow: 
    0 0 5px #ffaa00,       /* 核心亮光 */
    0 0 15px #ff3300,      /* 中层红光 */
    0 0 30px rgba(210, 43, 43, 0.8), /* 外层氛围光 */
    inset 0 -2px 5px rgba(0,0,0,0.5); /* 底部阴影增加立体感 */
  opacity: 0.8;
  animation: breathe 3s infinite ease-in-out alternate;
  position: relative;
}

/* 顶部的微小火苗/热浪 */
.fire-core::after {
  content: '';
  position: absolute;
  top: -40%; left: 20%; width: 60%; height: 60%;
  background: radial-gradient(ellipse at center bottom, rgba(255,200,0,0.8) 0%, rgba(255,50,0,0) 70%);
  border-radius: 50% 50% 0 0;
  filter: blur(2px);
  opacity: 0.6;
  animation: rise 1.5s infinite linear;
}

/* 悬浮交互：燃烧更剧烈 */
.spark-item:hover .fire-core { 
  transform: scale(1.4); opacity: 1;
  /* 悬浮时核心变得更白更亮 */
  background: radial-gradient(circle at center bottom, #fff 20%, #ffdd33 40%, #ff4400 70%, #880000 100%);
  box-shadow: 0 0 10px #fff, 0 0 25px #ff5500, 0 0 50px #ff0000;
}

/* 呼吸动画优化 */
@keyframes breathe { 
  0% { transform: scale(0.95); opacity: 0.7; filter: brightness(0.8); } 
  100% { transform: scale(1.05); opacity: 1; filter: brightness(1.2); } 
}
/* 火苗上升动画 */
@keyframes rise {
  0% { transform: translateY(0) scaleX(1); opacity: 0.5; }
  50% { transform: translateY(-3px) scaleX(0.8); opacity: 0.8; }
  100% { transform: translateY(-6px) scaleX(0.6); opacity: 0; }
}

/* 卡片调整 */
.spark-card {
  position: absolute; bottom: 35px; /* 位置微调 */
  left: 50%; transform: translateX(-50%) translateY(10px);
  background: rgba(20, 0, 0, 0.9); /* 背景带点红 */
  border: 1px solid #421; /* 边框带点红 */
  padding: 10px 14px; border-radius: 4px; width: max-content;
  opacity: 0; visibility: hidden; transition: all 0.3s; pointer-events: none; z-index: 50;
}
.spark-item:hover .spark-card { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.donor-name { font-size: 12px; color: #a66; margin-bottom: 3px; }
.donor-msg { font-size: 14px; color: #fff; font-family: "Songti SC", serif; }

/* 弹窗 (不变) */
.qr-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 500; backdrop-filter: blur(5px); }
.modal-content { background: #111; border: 1px solid #333; padding: 30px; border-radius: 12px; text-align: center; }
.qr-img { width: 200px; margin: 20px 0; opacity: 0.9; border-radius: 8px; }
.close-btn { background: none; border: 1px solid #444; color: #666; padding: 6px 20px; border-radius: 20px; cursor: pointer; margin-top: 15px; }
.close-btn:hover { border-color: #fff; color: #fff; }

@media (max-width: 768px) {
  .header-section { padding-top: 12vh; }
  .title { font-size: 1.5rem; letter-spacing: 6px; margin-bottom: 10px; }
  .intro-text { font-size: 13px; }
  .time-stats { font-size: 11px; margin-bottom: 15px; }
  .progress-line-bg { width: 180px; }
  .glass-btn { padding: 6px 20px; font-size: 11px; }
  .sparks-field { gap: 40px; padding-bottom: 80px; }
}
</style>