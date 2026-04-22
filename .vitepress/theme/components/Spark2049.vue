<script setup>
import { ref, onMounted, computed } from 'vue' // 引入 computed
import donors from '../../donors.json'

// --- 配置参数 ---
const COST_PER_YEAR = 85 // 每年运营成本
const startDate = new Date('2025-12-19') // 建站日
const targetDate = new Date('2049-10-01') // 终极目标
const baseFundedDate = new Date('2026-12-19') // 初始自费保障到的日期
const today = new Date()

// --- 🔴 核心逻辑：自动计算金额与日期 ---
// 1. 计算捐赠总额
const totalDonation = donors.reduce((sum, d) => sum + Number(d.amount || 0), 0)

// 2. 将金额折算为天数 (金额 / 85 * 365)
const extraDays = Math.floor((totalDonation / COST_PER_YEAR) * 365)

// 3. 最终动态保障日期 = 初始保障日期 + 捐赠天数
const fundedDate = new Date(baseFundedDate.getTime() + extraDays * 24 * 60 * 60 * 1000)

// 4. 格式化显示的日期 (YYYY年MM月DD日)
const formattedFundedDate = `${fundedDate.getFullYear()}年${fundedDate.getMonth() + 1}月${fundedDate.getDate()}日`

// --- 进度计算 ---
const daysRun = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))

const totalDuration = targetDate - startDate
const currentDuration = today - startDate
const fundedDuration = fundedDate - startDate

const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)
const fundedPercent = Math.min((fundedDuration / totalDuration) * 100, 100).toFixed(4)

<template>
  <div class="spark-universe" @click="closeAll">
    <div class="header-section">
      <h1 class="title">星火计划</h1>
      
      <div class="intro-box">
        <p class="intro-text">愿景：将该站维护至 2049 年</p>
        <p class="sub-intro">（目前已获星火支持运营至 {{ formattedFundedDate }}）</p>
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
        <div class="fire-core"><div class="flame-tip"></div></div>
        
        <div class="spark-card" @click.stop>
          <div class="donor-meta">
            <span>{{ donor.date }}</span>
            <span class="amount">￥{{ donor.amount }}</span>
          </div>
          <div class="donor-name">@{{ donor.name }}</div>
          <div class="donor-msg">“{{ donor.message }}”</div>
        </div>
      </div>
    </div>

    </div>
</template>

<style scoped>
/* 基础样式保持不变 */
.spark-universe {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; height: 100dvh;
  background: #000; z-index: 200; color: #fff; display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.back-home {
  position: absolute; top: 20px; left: 20px; color: rgba(255,255,255,0.4);
  text-decoration: none; font-size: 13px; letter-spacing: 1px; transition: 0.3s; z-index: 300;
}
.back-home:hover { color: #fff; }

.header-section {
  padding-top: 15vh; width: 100%; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 10;
}
.title {
  font-size: 2.4rem; font-weight: 200; letter-spacing: 8px; color: #fff;
  margin: 0 0 15px 0; text-shadow: 0 0 30px rgba(255, 50, 50, 0.2); opacity: 0.95; text-align: center;
}
/* 🔴 新增：火种卡片内的金额与日期样式 */
.donor-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
  letter-spacing: 0;
  font-family: sans-serif;
}
.donor-meta .amount {
  color: #ffcc00; /* 金色显示金额，更有仪式感 */
  font-weight: bold;
}

.donor-name { 
  font-size: 11px; /* 稍微调大一点 */
  color: #eaa; 
  margin-bottom: 4px; 
  font-weight: 600;
}

.donor-msg { 
  font-size: 12px; 
  color: #fff; 
  font-family: "Songti SC", serif; 
  line-height: 1.4;
  border-top: 1px solid rgba(255,100,100,0.1);
  padding-top: 4px;
}

/* --- 文案区域修改 --- */
.intro-box {
  display: flex; flex-direction: column; /* 改为纵向排列 */
  align-items: center; 
  margin-bottom: 30px;
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif; font-size: 15px; letter-spacing: 2px;
  color: rgba(255,255,255,0.8); font-weight: 300; text-align: center;
  margin: 0 0 8px 0; /* 增加一点下间距 */
}
/* 🔴 新增：运营期限文字样式 */
.sub-intro {
  font-family: "Songti SC", "SimSun", serif;
  font-size: 12px; 
  color: #888; /* 暗灰色，不抢主文案 */
  letter-spacing: 1px;
  margin: 0;
  opacity: 0.8;
}

.time-stats {
  font-size: 12px; color: #ccc; margin-bottom: 25px;
  letter-spacing: 1px; display: flex; justify-content: center; align-items: center;
}
.divider { margin: 0 10px; color: #444; }

/* --- 进度条修改 --- */
.progress-container { width: 100%; display: flex; justify-content: center; margin-bottom: 35px; }
.progress-line-bg {
  width: 260px; height: 1px; 
  background: rgba(255,255,255,0.1); /* 灰色底 */
  position: relative;
}
/* 🔴 新增：已运营保障条 (暗红) */
.progress-line-funded {
  position: absolute; left: 0; top: 0; height: 100%;
  background: rgba(210, 43, 43, 0.5); /* 半透明暗红 */
  box-shadow: 0 0 5px rgba(210, 43, 43, 0.3);
  z-index: 1; /* 在灰底之上，在白点之下 */
  transition: width 1s ease;
}
/* 活跃进度条 (今天) */
.progress-line-active {
  position: absolute; left: 0; top: 0; height: 100%;
  background: #fff; /* 亮白 */
  z-index: 2; /* 最上层 */
  box-shadow: 0 0 8px rgba(255,255,255,0.4);
}
.glowing-dot {
  position: absolute; right: -2px; top: -2px; width: 5px; height: 5px; background: #fff; border-radius: 50%;
  box-shadow: 0 0 5px #fff, 0 0 10px #ff3333;
}

/* 按钮 */
.glass-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 28px; border-radius: 50px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px); color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer; transition: all 0.4s ease; letter-spacing: 1px;
}
.glass-btn:hover { background: rgba(255, 50, 50, 0.15); border-color: rgba(255, 50, 50, 0.3); color: #fff; transform: translateY(-1px); }

/* 星火区 */
.sparks-field {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  flex-wrap: wrap; gap: 50px; padding-bottom: calc(100px + env(safe-area-inset-bottom)); perspective: 500px;
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

/* 卡片 */
.spark-card {
  position: absolute; bottom: 45px; left: 50%; transform: translateX(-50%) translateY(10px);
  background: rgba(20, 0, 0, 0.95); border: 1px solid #633;
  padding: 8px 12px; border-radius: 6px; width: max-content; max-width: 200px;
  opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 50; pointer-events: none;
  backdrop-filter: blur(4px);
}
.spark-item:hover .spark-card, .spark-item.is-active .spark-card { 
  opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0);
}
.donor-name { font-size: 10px; color: #eaa; margin-bottom: 2px; opacity: 0.8; }
.donor-msg { font-size: 12px; color: #fff; font-family: "Songti SC", serif; line-height: 1.4; }

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