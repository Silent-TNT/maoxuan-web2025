<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'
import rawDonors from '../../donors.json'
import { BaiduTrack } from '../baidu-tongji.mjs'

const { isDark } = useData()
const htmlHasDark = ref(false)

function syncDarkClass() {
  if (typeof document !== 'undefined') {
    htmlHasDark.value = document.documentElement.classList.contains('dark')
  }
}

const darkMode = computed(() => isDark?.value ?? htmlHasDark.value)

let darkObserver = null
onMounted(() => {
  syncDarkClass()
  darkObserver = new MutationObserver(syncDarkClass)
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})
onUnmounted(() => {
  darkObserver?.disconnect()
})

// --- 预处理捐赠数据 ---
const donors = rawDonors.map(d => {
  const amount = Number(d.amount || 0)
  
  // 核心算法：利用对数曲线计算火苗大小。
  // 1元 ≈ 0.9倍大小， 10元 ≈ 1.2倍， 84元 ≈ 1.56倍
  // 这样既能体现金额差距，又能防止大额打赏让火种占满全屏
  const scale = 0.8 + Math.log10(amount + 1) * 0.4
  
  return {
    ...d,
    scale: scale.toFixed(2), // 绑定给火苗的大小比例
    delay: Math.random() * 2 + 's' // 随机呼吸动画延迟
  }
})

const DANMAKU_LANES = 6
const danmakuList = computed(() => {
  if (!donors.length) return []
  const items = []
  const laneCounters = Array(DANMAKU_LANES).fill(0)

  for (let loop = 0; loop < 3; loop++) {
    const pool = [...donors].sort(() => Math.random() - 0.5)
    pool.forEach((d, i) => {
      const lane = (loop * donors.length + i) % DANMAKU_LANES
      const slot = laneCounters[lane]++
      const duration = 18 + (lane % 3) * 2
      // 负延迟：进入页面时弹幕已分散在轨道上，避免全部挤在左侧
      const delay = -(slot * (duration / 2.2) + lane * 1.8)
      items.push({
        key: `dm-${loop}-${lane}-${slot}`,
        name: d.name,
        message: d.message || '星星之火，可以燎原',
        amount: d.amount,
        lane,
        duration,
        delay,
      })
    })
  }
  return items
})

// --- 配置参数 ---
const COST_PER_YEAR = 100
const startDate = new Date('2025-12-19') 
const targetDate = new Date('2049-10-01') 
const baseFundedDate = new Date('2025-12-19') 
const today = new Date()

// --- 自动计算金额与日期 ---
const totalDonation = donors.reduce((sum, d) => sum + Number(d.amount || 0), 0)
const extraDays = Math.floor((totalDonation / COST_PER_YEAR) * 365)
const fundedDate = new Date(baseFundedDate.getTime() + extraDays * 24 * 60 * 60 * 1000)
const formattedFundedDate = `${fundedDate.getFullYear()}年${fundedDate.getMonth() + 1}月${fundedDate.getDate()}日`

// --- 进度计算 ---
const daysRun = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))

const totalDuration = targetDate - startDate
const currentDuration = today - startDate
const fundedDuration = fundedDate - startDate

const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)
const fundedPercent = Math.min((fundedDuration / totalDuration) * 100, 100).toFixed(4)

// --- 交互逻辑 ---
const showQR = ref(false)
const activeIndex = ref(-1)

const toggleSpark = (index, event) => {
  event.stopPropagation()
  activeIndex.value = activeIndex.value === index ? -1 : index
}
const closeAll = () => activeIndex.value = -1

function openDonateQr() {
  showQR.value = true
  BaiduTrack.donateClick('panel')
}

function closeDonateModal() {
  showQR.value = false
}
</script>

<template>
  <div
    class="spark-universe"
    :class="{ 'spark-universe--dark': darkMode }"
    @click="closeAll"
  >
    <a href="/" class="back-home">
      <span class="arrow">←</span> 首页
    </a>

    <div class="header-section">
      <h1 class="title">星火计划</h1>
      
      <div class="intro-box">
        <p class="intro-text">愿景：将该站维护至 2049 年</p>
        <p class="sub-intro">（目前已获星火支持运营至 {{ formattedFundedDate }}）</p>
      </div>

      <div class="time-stats">
        <span class="stat-group">已运行 {{ daysRun }} 天</span>
        <span class="divider">/</span>
        <span class="stat-group">距建国百年还需 {{ daysLeft }} 天</span>
      </div>
      
      <div class="progress-container">
        <div class="progress-line-bg">
          <div class="progress-line-funded" :style="{ width: fundedPercent + '%' }"></div>
          <div class="progress-line-active" :style="{ width: progressPercent + '%' }">
            <div class="glowing-dot"></div>
          </div>
        </div>
      </div>

      <div class="action-area">
        <div class="glass-btn" @click.stop="openDonateQr">
          <span class="plus">+</span> 注入星火
        </div>
      </div>
    </div>

    <div class="sparks-field">
      <div 
        v-for="(donor, index) in donors" 
        :key="index"
        class="spark-item"
        :class="{ 'is-active': activeIndex === index }" 
        @click="(e) => toggleSpark(index, e)"
      >
        <div class="fire-wrapper" :style="{ transform: `scale(${donor.scale})` }">
          <div class="fire-core" :style="{ animationDelay: donor.delay }">
            <div class="flame-tip"></div>
          </div>
        </div>
        
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

    <div v-if="showQR" class="qr-modal" @click="closeDonateModal">
      <div class="pay-panel" role="dialog" aria-label="捐赠" @click.stop>
        <button type="button" class="pay-panel-close" aria-label="关闭" @click="closeDonateModal">×</button>
        <h3 class="pay-panel-title">注入星火</h3>
        <p class="pay-panel-desc">
          <span>用于域名、服务器与 AI 接口。</span>
          <span>目前站点不含算力成本为{{ COST_PER_YEAR }}元/年</span>
        </p>
        <div class="qr-duo">
          <div class="qr-slot">
            <img src="/wechat-pay.jpg" alt="微信收款码" class="qr-img" />
          </div>
          <div class="qr-slot">
            <img src="/alipay-pay.jpg" alt="支付宝收款码" class="qr-img" />
          </div>
        </div>
        <p class="pay-note">请备注 <strong>【用户+寄语】</strong>，便于登记在星火墙上</p>
        <button type="button" class="close-btn" @click="closeDonateModal">稍后再说</button>
      </div>
    </div>

    <!-- 左下角寄语弹幕 -->
    <div class="danmaku-zone" aria-hidden="true">
      <div
        v-for="item in danmakuList"
        :key="item.key"
        class="danmaku-item"
        :style="{
          '--lane': item.lane,
          '--duration': `${item.duration}s`,
          '--delay': `${item.delay}s`,
        }"
      >
        <span class="danmaku-name">@{{ item.name }}</span>
        <span class="danmaku-msg">「{{ item.message }}」</span>
        <span class="danmaku-amount">￥{{ item.amount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 星火页：随站点白天/夜间切换 */
.spark-universe {
  --spark-bg: #f5f5f7;
  --spark-text: #1a1a1a;
  --spark-muted: #666;
  --spark-border: #e8e8e8;
  --spark-card-bg: #fff;
  --spark-card-text: #333;
  --spark-progress-bg: #e8e8e8;
  --spark-dot-ring: #fff;
  --danmaku-bg: rgba(255, 255, 255, 0.92);
  --danmaku-border: rgba(200, 40, 41, 0.2);
  --danmaku-shadow: rgba(0, 0, 0, 0.08);
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: var(--spark-bg);
  z-index: 200;
  color: var(--spark-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.35s ease, color 0.35s ease;
}
.spark-universe--dark {
  --spark-bg: #0f0f12;
  --spark-text: #ececec;
  --spark-muted: #a8a8a8;
  --spark-border: #3a3a40;
  --spark-card-bg: #1c1c22;
  --spark-card-text: #e0e0e0;
  --spark-progress-bg: #333;
  --spark-dot-ring: #0f0f12;
  --danmaku-bg: rgba(28, 28, 34, 0.92);
  --danmaku-border: rgba(255, 100, 60, 0.35);
  --danmaku-shadow: rgba(0, 0, 0, 0.35);
}
.back-home {
  position: absolute;
  top: 20px;
  left: 20px;
  color: var(--spark-muted);
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 1px;
  transition: 0.3s;
  z-index: 300;
}
.back-home:hover { color: #c82829; }

.header-section {
  padding-top: 15vh; width: 100%; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 10;
}
.title {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 8px;
  color: var(--spark-text);
  margin: 0 0 15px 0;
  text-align: center;
}

/* 火种卡片文字样式 */
.donor-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--spark-muted);
  margin-bottom: 4px;
  letter-spacing: 0;
  font-family: sans-serif;
}
.donor-meta .amount {
  color: #c82829;
  font-weight: bold;
}

.donor-name {
  font-size: 11px;
  color: var(--spark-muted);
  margin-bottom: 4px;
  font-weight: 600;
}

.donor-msg {
  font-size: 12px;
  color: var(--spark-card-text);
  font-family: "Songti SC", serif;
  line-height: 1.4;
  border-top: 1px solid var(--spark-border);
  padding-top: 4px;
}

/* 文案区域 */
.intro-box {
  display: flex; flex-direction: column;
  align-items: center; 
  margin-bottom: 30px;
}
.intro-text {
  font-family: "Songti SC", "SimSun", serif;
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--spark-muted);
  font-weight: 300;
  text-align: center;
  margin: 0 0 8px 0;
}
.sub-intro {
  font-family: "Songti SC", "SimSun", serif;
  font-size: 12px;
  color: var(--spark-muted);
  letter-spacing: 1px;
  margin: 0;
  opacity: 0.85;
}

.time-stats {
  font-size: 12px;
  color: var(--spark-muted);
  margin-bottom: 25px;
  letter-spacing: 1px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.divider { margin: 0 10px; color: var(--spark-border); }

/* 进度条 */
.progress-container { width: 100%; display: flex; justify-content: center; margin-bottom: 35px; }
.progress-line-bg {
  width: 260px;
  height: 2px;
  background: var(--spark-progress-bg);
  position: relative;
  border-radius: 1px;
}
.progress-line-funded {
  position: absolute; left: 0; top: 0; height: 100%;
  background: rgba(200, 40, 41, 0.35);
  border-radius: 1px;
  z-index: 1;
  transition: width 1s ease;
}
.progress-line-active {
  position: absolute; left: 0; top: 0; height: 100%;
  background: #c82829;
  border-radius: 1px;
  z-index: 2;
}
.glowing-dot {
  position: absolute;
  right: -3px;
  top: -3px;
  width: 7px;
  height: 7px;
  background: #c82829;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--spark-dot-ring), 0 0 8px rgba(200, 40, 41, 0.5);
}

/* 按钮 */
.glass-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 28px;
  border-radius: 50px;
  background: var(--spark-card-bg);
  border: 1px solid rgba(200, 40, 41, 0.35);
  color: #c82829;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 1px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.glass-btn:hover {
  background: rgba(200, 40, 41, 0.08);
  border-color: #c82829;
  transform: translateY(-1px);
}
.glass-btn .plus { font-weight: 300; }

/* 星火区 */
.sparks-field {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-wrap: wrap;
  gap: 50px;
  padding-bottom: calc(240px + env(safe-area-inset-bottom));
  perspective: 500px;
  position: relative;
  z-index: 20;
}
.spark-item {
  position: relative;
  width: 18px;
  height: 16px;
  cursor: pointer;
}

.fire-wrapper {
  width: 100%;
  height: 100%;
  transform-origin: center bottom;
}

.fire-core {
  width: 100%;
  height: 100%;
  border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%;
  background: radial-gradient(circle at center bottom, #fff 15%, #ffcc00 45%, #ff5500 75%, #cc2200 100%);
  border: 1px solid rgba(180, 40, 0, 0.35);
  box-shadow:
    0 2px 6px rgba(180, 40, 0, 0.35),
    0 0 10px rgba(255, 120, 0, 0.55),
    0 0 18px rgba(255, 80, 0, 0.35);
  filter: drop-shadow(0 2px 4px rgba(200, 50, 0, 0.45));
  animation: breathe 3s infinite ease-in-out alternate;
  position: relative;
  transition: transform 0.3s;
}
.fire-core::after {
  content: '';
  position: absolute;
  top: -35%;
  left: 22%;
  width: 56%;
  height: 55%;
  background: radial-gradient(ellipse at center bottom, rgba(255, 200, 0, 0.95) 0%, rgba(255, 80, 0, 0) 72%);
  border-radius: 50% 50% 0 0;
  opacity: 0.85;
  animation: rise 1.5s infinite linear;
}
.flame-tip { display: none; }
.spark-item:hover .fire-core,
.spark-item.is-active .fire-core {
  transform: scale(1.3);
  box-shadow:
    0 2px 8px rgba(180, 40, 0, 0.45),
    0 0 16px rgba(255, 100, 0, 0.7),
    0 0 28px rgba(255, 60, 0, 0.5);
}
@keyframes breathe {
  0% { transform: scale(0.92); filter: drop-shadow(0 2px 3px rgba(200, 50, 0, 0.4)); }
  100% { transform: scale(1.08); filter: drop-shadow(0 3px 6px rgba(200, 50, 0, 0.55)); }
}
@keyframes rise {
  0% { transform: translateY(0) scaleX(1); opacity: 0.5; }
  100% { transform: translateY(-8px) scaleX(0.5); opacity: 0; }
}

/* 左下角寄语弹幕 */
.danmaku-zone {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 220px;
  overflow: hidden;
  pointer-events: none;
  z-index: 12;
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    #000 6%,
    #000 94%,
    transparent 100%
  );
}
.danmaku-item {
  position: absolute;
  left: 0;
  top: calc(var(--lane, 0) * 34px + 10px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--danmaku-bg);
  border: 1px solid var(--danmaku-border);
  box-shadow: 0 2px 10px var(--danmaku-shadow);
  font-size: 13px;
  color: var(--spark-text);
  white-space: nowrap;
  animation: danmaku-run var(--duration, 18s) linear infinite;
  animation-delay: var(--delay, 0s);
  animation-fill-mode: backwards;
  will-change: transform;
}
.danmaku-name {
  color: #c82829;
  font-weight: 600;
}
.danmaku-msg {
  color: var(--spark-muted);
  font-family: "Songti SC", "SimSun", serif;
  max-width: 42vw;
  overflow: hidden;
  text-overflow: ellipsis;
}
.danmaku-amount {
  color: #c82829;
  font-weight: 700;
  font-size: 12px;
}
@keyframes danmaku-run {
  0% { transform: translateX(100vw); }
  100% { transform: translateX(calc(-100% - 24px)); }
}

@media (prefers-reduced-motion: reduce) {
  .fire-core,
  .fire-core::after,
  .danmaku-item {
    animation: none !important;
  }
  .danmaku-item {
    display: none;
  }
}

/* 捐赠者卡片 */
.spark-card {
  position: absolute;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: var(--spark-card-bg);
  border: 1px solid var(--spark-border);
  padding: 8px 12px;
  border-radius: 8px;
  width: max-content;
  max-width: 200px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  z-index: 50;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}
.spark-item:hover .spark-card, .spark-item.is-active .spark-card { 
  opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0);
}

/* 捐赠弹窗 */
.qr-modal {
  position: fixed; inset: 0; z-index: 500;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}
.spark-universe--dark .qr-modal {
  background: rgba(0, 0, 0, 0.55);
  padding: 0 16px calc(16px + env(safe-area-inset-bottom));
}
.pay-panel {
  position: relative;
  width: 100%;
  max-width: min(92vw, 520px);
  background: var(--spark-card-bg);
  color: var(--spark-text);
  border-radius: 16px 16px 0 0;
  padding: 36px 24px 28px;
  text-align: center;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--spark-border);
  border-bottom: none;
}
.spark-universe--dark .pay-panel-close { color: var(--spark-muted); }
.spark-universe--dark .pay-panel-close:hover { color: var(--spark-text); }
.spark-universe--dark .qr-slot { background: #252528; }
.spark-universe--dark .close-btn {
  background: #252528;
  border-color: var(--spark-border);
  color: var(--spark-muted);
}
.spark-universe--dark .pay-note { color: var(--spark-muted); }
.pay-panel-close {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}
.pay-panel-close:hover { color: #333; }
.pay-panel-title {
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 600;
  color: var(--spark-text);
  letter-spacing: 2px;
}
.pay-panel-desc {
  margin: 0 auto 22px;
  max-width: 360px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--spark-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  text-align: center;
}
.pay-panel-desc span { display: block; }
.qr-duo {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: stretch;
  margin: 0 auto 20px;
  max-width: 440px;
}
.qr-slot {
  flex: 1;
  max-width: 200px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.1);
  background: var(--spark-progress-bg);
}
.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.pay-note {
  margin: 0 auto 18px;
  max-width: 360px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--spark-muted);
  text-align: center;
}
.pay-note strong { color: #c82829; font-weight: 600; }
.close-btn {
  background: var(--spark-card-bg);
  border: 1px solid var(--spark-border);
  color: var(--spark-muted);
  padding: 10px 36px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 15px;
}
.close-btn:hover { border-color: #bbb; color: #111; }

@media (min-width: 520px) {
  .qr-modal { align-items: center; padding-bottom: 24px; }
  .pay-panel {
    border-radius: 20px;
    padding: 40px 36px 32px;
    border-bottom: 1px solid #eee;
  }
  .pay-panel-title { font-size: 26px; }
  .pay-panel-desc { font-size: 16px; }
  .pay-note { font-size: 15px; }
  .qr-slot { height: 250px; max-width: 210px; }
}

@media (max-width: 768px) {
  .header-section { padding-top: 18vh; }
  .title { font-size: 1.8rem; letter-spacing: 5px; }
  .intro-text { font-size: 14px; }
  .progress-line-bg { width: 200px; }
  .intro-box, .time-stats, .progress-container, .action-area { display: flex; justify-content: center; }
  .danmaku-item { font-size: 12px; padding: 5px 10px; gap: 6px; }
  .danmaku-msg { max-width: 36vw; }
  .danmaku-zone { height: 180px; }
}
</style>