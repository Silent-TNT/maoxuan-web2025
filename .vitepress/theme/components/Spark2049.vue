<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'
import rawDonors from '../../donors.json'
import { BaiduTrack } from '../baidu-tongji.mjs'
import FireLottie from './FireLottie.vue'

const { isDark } = useData()
const htmlHasDark = ref(false)

function syncDarkClass() {
  if (typeof document !== 'undefined') {
    htmlHasDark.value = document.documentElement.classList.contains('dark')
  }
}

const darkMode = computed(() => isDark?.value ?? htmlHasDark.value)
function toggleTheme() { isDark.value = !darkMode.value }
const currentDay = ref('')
function updateCurrentDay() {
  const now = new Date()
  currentDay.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function isNewDonor(donor) {
  if (donors.slice(-2).includes(donor)) return true
  const date = String(donor.date).replace(/\./g, '-')
  const age = (Date.parse(currentDay.value) - Date.parse(date)) / 86400000
  return age >= 0 && age < 7
}
const COST_PER_YEAR = 200

let darkObserver = null
const universe = ref(null)
const header = ref(null)
const sparkPositions = ref([])
let layoutObserver = null
let layoutFrame = 0
let quoteTimer = null
let sparkMotionFrame = 0
let sparkMotionTime = 0
let sparkMotionPrevious = 0
let sparkMotionPreference = null
let sparkBases = []
let sparkOffsets = []
let sparkLocalOffsets = []
let sparkWander = []
let sparkBounds = { width: 0, height: 0 }
const hoveredSpark = ref(-1)
const sparkPointer = { x: 0, y: 0 }
const sparkBreeze = { x: 0, y: 0, windX: 0, windY: 0, time: 0, active: false }
const quoteIndex = ref(0)
const quoteAnimated = ref(true)
const manualQuoteRevision = ref(0)
let quoteHovered = false
let quoteFocused = false
const detailCard = ref(null)
const detailPosition = ref({ left: '12px', top: '12px' })
const detailPointer = ref({ side: 'bottom', style: {} })

// 固定序列生成起点；火苗可经过文字，仅在屏幕边缘转向。
function noise(index, salt = 0) {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function contentRects() {
  return [...header.value.children].map(el =>
    el.getBoundingClientRect()
  )
}

function layoutSparks() {
  const root = universe.value
  if (!root || !header.value) return
  const { width, height } = root.getBoundingClientRect()
  sparkBounds = { width, height }
  const compact = width < 769
  const placed = []
  const groups = compact
    ? [{ x: 0.19, y: 0.12, rx: 0.2, ry: 0.1 }, { x: 0.83, y: 0.38, rx: 0.13, ry: 0.31 }, { x: 0.46, y: 0.83, rx: 0.36, ry: 0.15 }]
    : [{ x: 0.16, y: 0.46, rx: 0.15, ry: 0.31 }, { x: 0.84, y: 0.37, rx: 0.13, ry: 0.29 }, { x: 0.59, y: 0.82, rx: 0.28, ry: 0.13 }]
  donors.forEach((donor, index) => {
    let point = null
    for (let attempt = 0; attempt < 200; attempt++) {
      const seed = index * 200 + attempt
      const group = groups[index % groups.length]
      const scattered = index % 7 === 0 || attempt >= 140
      let x = (scattered ? 0.05 + noise(seed, 1) * 0.9 : group.x + (noise(seed, 1) + noise(seed, 2) - 1) * group.rx) * width
      const y = (scattered ? 0.06 + noise(seed, 3) * 0.88 : group.y + (noise(seed, 3) + noise(seed, 4) - 1) * group.ry) * height
      if (compact && attempt >= 160) x = attempt % 2 ? 26 : width - 26
      const edge = compact ? 26 : 42
      if (x < edge || x > width - edge || y < edge || y > height - edge) continue
      if (placed.some(p => !p.hidden && Math.hypot(p.x - x, p.y - y) < (compact ? 44 : 64))) continue
      point = { x, y }
      break
    }
    placed.push(point || { x: -100, y: -100, hidden: true })
  })
  sparkBases = placed.map((p, index) => p.hidden
    ? { x: noise(index, 12) * width, y: noise(index, 13) * height }
    : p)
  sparkOffsets = placed.map(() => ({ x: 0, y: 0 }))
  sparkLocalOffsets = placed.map(() => ({ x: 0, y: 0 }))
  sparkBases = sparkBases.map(p => keepSparkClear(p.x, p.y))
  sparkWander = sparkBases.map((p, index) => ({ x: p.x, y: p.y, heading: noise(index, 14) * Math.PI * 2 }))
  sparkPositions.value = sparkBases.map((p, index) => ({
    left: `${p.x}px`, top: `${p.y}px`, visibility: 'visible',
    '--spark-opacity': '1',
    '--ember-size': '18px',
  }))
}

function trackSparkPointer(event) {
  if (event.pointerType === 'touch' || sparkMotionPreference?.matches) return
  const rect = universe.value.getBoundingClientRect()
  sparkPointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)))
  sparkPointer.y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)))
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const time = performance.now()
  const delta = Math.max(8, time - sparkBreeze.time)
  if (sparkBreeze.active && delta < 150) {
    const windX = (x - sparkBreeze.x) / delta * 12
    const windY = (y - sparkBreeze.y) / delta * 12
    const limit = Math.max(1, Math.hypot(windX, windY) / 3)
    sparkBreeze.windX = windX / limit
    sparkBreeze.windY = windY / limit
  } else {
    sparkBreeze.windX = sparkBreeze.windY = 0
  }
  Object.assign(sparkBreeze, { x, y, time, active: true })
}

function resetSparkPointer() {
  sparkPointer.x = sparkPointer.y = 0
  sparkBreeze.active = false
  sparkBreeze.windX = sparkBreeze.windY = 0
}

function keepSparkClear(x, y) {
  const { width, height } = sparkBounds
  return { x: Math.max(26, Math.min(width - 26, x)), y: Math.max(26, Math.min(height - 26, y)) }
}

function animateSparks(time) {
  const delta = sparkMotionPrevious ? Math.min(time - sparkMotionPrevious, 48) : 16
  sparkMotionPrevious = time
  sparkMotionTime += delta
  const easing = 1 - Math.exp(-delta / 700)
  const breezeDecay = Math.exp(-delta / 900)
  sparkBreeze.windX *= breezeDecay
  sparkBreeze.windY *= breezeDecay
  const items = universe.value?.querySelectorAll('.spark-item') || []
  items.forEach((item, index) => {
    const base = sparkBases[index]
    const offset = sparkOffsets[index]
    const wander = sparkWander[index]
    const local = sparkLocalOffsets[index]
    if (!base || !offset || !wander || !local || activeIndex.value === index || hoveredSpark.value === index || showQR.value) return
    const compact = sparkBounds.width < 769
    const depth = (compact ? 0.3 : 1) * (8 + noise(index, 9) * 10)
    wander.heading += Math.sin(sparkMotionTime / 45000 + index) * delta / 90000
    const speed = (compact ? 4 : 7) + noise(index, 15) * (compact ? 3 : 5)
    const proposedX = wander.x + Math.cos(wander.heading) * speed * delta / 1000
    const proposedY = wander.y + Math.sin(wander.heading) * speed * delta / 1000
    const safePoint = keepSparkClear(proposedX, proposedY)
    if (Math.abs(safePoint.x - proposedX) > 0.01) wander.heading = Math.PI - wander.heading
    if (Math.abs(safePoint.y - proposedY) > 0.01) wander.heading = -wander.heading
    wander.x = safePoint.x
    wander.y = safePoint.y
    const x = sparkPointer.x * depth
    const y = sparkPointer.y * depth
    offset.x += (x - offset.x) * easing
    offset.y += (y - offset.y) * easing
    // 保留整屏跟随；局部仅额外偏移最多 3px，且移动速率不超过 2.5px/s。
    const distance = Math.hypot(wander.x + offset.x - sparkBreeze.x, wander.y + offset.y - sparkBreeze.y)
    const proximity = sparkBreeze.active ? Math.max(0, 1 - distance / 220) : 0
    const influence = proximity * proximity * (3 - 2 * proximity)
    const localEasing = 1 - Math.exp(-delta / 450)
    const dx = (sparkBreeze.windX * influence - local.x) * localEasing
    const dy = (sparkBreeze.windY * influence - local.y) * localEasing
    const rateLimit = Math.max(1, Math.hypot(dx, dy) / (2.5 * delta / 1000))
    local.x += dx / rateLimit
    local.y += dy / rateLimit
    const finalPoint = keepSparkClear(wander.x + offset.x + local.x, wander.y + offset.y + local.y)
    const finalX = finalPoint.x
    const finalY = finalPoint.y
    item.style.transform = `translate(${(finalX - base.x).toFixed(2)}px, ${(finalY - base.y).toFixed(2)}px)`
  })
  sparkMotionFrame = requestAnimationFrame(animateSparks)
}

function syncSparkMotion() {
  cancelAnimationFrame(sparkMotionFrame)
  sparkMotionPrevious = 0
  if (!sparkMotionPreference.matches && !document.hidden) sparkMotionFrame = requestAnimationFrame(animateSparks)
  else if (sparkMotionPreference.matches) {
    resetSparkPointer()
  }
}

function scheduleLayout() {
  cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(() => {
    layoutSparks()
    nextTick(() => {
      universe.value?.querySelectorAll('.spark-item').forEach((item, index) => {
        item.style.transform = ''
      })
      const anchor = universe.value?.querySelector('.spark-item.is-active')
      if (anchor && getComputedStyle(anchor).visibility === 'visible') positionDetail(anchor)
      else closeAll()
    })
  })
}

onMounted(() => {
  syncDarkClass()
  updateCurrentDay()
  document.addEventListener('visibilitychange', updateCurrentDay)
  shuffleDonors()
  sparkMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  sparkMotionPreference.addEventListener('change', syncSparkMotion)
  sparkMotionPreference.addEventListener('change', syncQuoteMotion)
  document.addEventListener('visibilitychange', syncSparkMotion)
  window.addEventListener('pointermove', trackSparkPointer, { passive: true })
  document.documentElement.addEventListener('pointerleave', resetSparkPointer)
  syncSparkMotion()
  scheduleQuote()
  layoutObserver = new ResizeObserver(scheduleLayout)
  layoutObserver.observe(universe.value)
  layoutObserver.observe(header.value)
  scheduleLayout()
  darkObserver = new MutationObserver(syncDarkClass)
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', updateCurrentDay)
  darkObserver?.disconnect()
  layoutObserver?.disconnect()
  cancelAnimationFrame(layoutFrame)
  clearTimeout(quoteTimer)
  cancelAnimationFrame(sparkMotionFrame)
  sparkMotionPreference?.removeEventListener('change', syncSparkMotion)
  sparkMotionPreference?.removeEventListener('change', syncQuoteMotion)
  document.removeEventListener('visibilitychange', syncSparkMotion)
  window.removeEventListener('pointermove', trackSparkPointer)
  document.documentElement.removeEventListener('pointerleave', resetSparkPointer)
})

// --- 预处理捐赠数据 ---
const donors = rawDonors.map(d => {
  const amount = Number(d.amount || 0)

  // 核心算法：利用对数曲线计算火苗大小。
  // 1元 ≈ 0.9倍大小， 10元 ≈ 1.2倍， 84元 ≈ 1.56倍
  // 这样既能体现金额差距，又能防止大额打赏让火种占满全屏
  const scale = 0.8 + Math.log10(amount + 1) * 0.4
  const supportDays = ((amount / COST_PER_YEAR) * 365).toFixed(1)

  return {
    ...d,
    supportDays,
    scale: scale.toFixed(2), // 绑定给火苗的大小比例
    delay: `${-noise(rawDonors.indexOf(d), 7) * 5}s`
  }
})

const shuffledDanmakuDonors = ref([])

function shuffleDonors() {
  const shuffled = [...donors]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  shuffledDanmakuDonors.value = shuffled
}

const featuredQuote = computed(() => {
  const displayDonors = shuffledDanmakuDonors.value.length ? shuffledDanmakuDonors.value : donors
  return displayDonors.length ? displayDonors[quoteIndex.value % displayDonors.length] : null
})

// --- 配置参数 ---
const startDate = new Date('2025-12-19')
const targetDate = new Date('2049-10-01')
const baseFundedDate = new Date('2025-12-19')
const today = new Date()

// --- 自动计算金额与日期 ---
const totalDonation = donors.reduce((sum, d) => sum + Number(d.amount || 0), 0)
const totalSupportDays = Math.round((totalDonation / COST_PER_YEAR) * 365)
const oneYuanDays = (365 / COST_PER_YEAR).toFixed(1)
const extraDays = Math.floor((totalDonation / COST_PER_YEAR) * 365)
const fundedDate = new Date(baseFundedDate.getTime() + extraDays * 24 * 60 * 60 * 1000)
const formattedFundedDate = `${fundedDate.getFullYear()}年${fundedDate.getMonth() + 1}月${fundedDate.getDate()}日`

// --- 进度计算 ---
const daysRun = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
const shortFundedDate = `${fundedDate.getFullYear()}.${String(fundedDate.getMonth() + 1).padStart(2, '0')}.${String(fundedDate.getDate()).padStart(2, '0')}`

const totalDuration = targetDate - startDate
const currentDuration = today - startDate
const fundedDuration = fundedDate - startDate

const progressPercent = Math.min((currentDuration / totalDuration) * 100, 100).toFixed(4)
const fundedPercent = Math.min((fundedDuration / totalDuration) * 100, 100).toFixed(4)

// --- 交互逻辑 ---
const showQR = ref(false)
const activeIndex = ref(-1)

const activeDonor = computed(() => donors[activeIndex.value] || null)

function positionDetail(anchor) {
  if (!detailCard.value || !anchor) return
  const rect = anchor.getBoundingClientRect()
  const card = detailCard.value.getBoundingClientRect()
  const clamp = p => ({
    ...p,
    x: Math.max(12, Math.min(p.x, window.innerWidth - card.width - 12)),
    y: Math.max(12, Math.min(p.y, window.innerHeight - card.height - 12)),
  })
  const candidates = [
    { x: rect.left + rect.width / 2 - card.width / 2, y: rect.top - card.height - 10 },
    { x: rect.left + rect.width / 2 - card.width / 2, y: rect.bottom + 10 },
    { x: rect.right + 10, y: rect.top + rect.height / 2 - card.height / 2 },
    { x: rect.left - card.width - 10, y: rect.top + rect.height / 2 - card.height / 2 },
  ].map(clamp)
  const protectedRects = [...contentRects(), universe.value.querySelector('.back-home').getBoundingClientRect()]
  const overlap = p => protectedRects.reduce((sum, r) => sum +
    Math.max(0, Math.min(p.x + card.width, r.right) - Math.max(p.x, r.left)) *
    Math.max(0, Math.min(p.y + card.height, r.bottom) - Math.max(p.y, r.top)), 0)
  const anchorX = rect.left + rect.width / 2
  const anchorY = rect.top + rect.height / 2
  const score = p => overlap(p) + (anchorX > p.x && anchorX < p.x + card.width && anchorY > p.y && anchorY < p.y + card.height ? 1e9 : 0)
  candidates.sort((a, b) => score(a) - score(b))
  const chosen = candidates[0]
  detailPosition.value = { left: `${chosen.x}px`, top: `${chosen.y}px` }
  const x = rect.left + rect.width / 2 - chosen.x
  const y = rect.top + rect.height / 2 - chosen.y
  const horizontal = { left: `${Math.max(18, Math.min(x, card.width - 18)) - 5}px` }
  const vertical = { top: `${Math.max(18, Math.min(y, card.height - 18)) - 5}px` }
  detailPointer.value = y < 0 ? { side: 'top', style: horizontal }
    : y > card.height ? { side: 'bottom', style: horizontal }
    : x < 0 ? { side: 'left', style: vertical }
    : x > card.width ? { side: 'right', style: vertical }
    : { side: 'none', style: {} }
}

async function toggleSpark(index, event) {
  event.stopPropagation()
  const anchor = event.currentTarget
  activeIndex.value = activeIndex.value === index ? -1 : index
  await nextTick()
  if (activeIndex.value === index) positionDetail(anchor)
}
const closeAll = () => activeIndex.value = -1

function stepQuote(direction) {
  if (!donors.length) return
  quoteAnimated.value = false
  // 重建过渡容器，手动切换也能立即结束正在进行的自动淡出。
  manualQuoteRevision.value += 1
  quoteIndex.value = (quoteIndex.value + direction + donors.length) % donors.length
  scheduleQuote(8000)
}

function scheduleQuote(delay = 5000) {
  clearTimeout(quoteTimer)
  if (sparkMotionPreference?.matches || quoteHovered || quoteFocused) return
  quoteTimer = window.setTimeout(() => {
    const selection = window.getSelection()
    const readingSelection = !selection?.isCollapsed && header.value?.querySelector('#spark-quote')?.contains(selection?.anchorNode)
    if (document.hidden || showQR.value || readingSelection) {
      scheduleQuote(8000)
      return
    }
    quoteAnimated.value = true
    quoteIndex.value += 1
    scheduleQuote()
  }, delay)
}

function syncQuoteMotion() { scheduleQuote() }
function holdQuote(event) {
  if (event.pointerType === 'touch') return
  quoteHovered = true
  clearTimeout(quoteTimer)
}
function releaseQuote() { quoteHovered = false; scheduleQuote(8000) }
function focusQuote(event) {
  quoteFocused = event.target.matches(':focus-visible')
  if (quoteFocused) clearTimeout(quoteTimer)
}
function blurQuote(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  quoteFocused = false
  scheduleQuote(8000)
}

function openDonateQr() {
  closeAll()
  showQR.value = true
  BaiduTrack.donateClick('panel')
}

function closeDonateModal() {
  showQR.value = false
}
</script>

<template>
  <div
    ref="universe"
    class="spark-universe"
    :class="{ 'spark-universe--dark': darkMode }"
    @click="closeAll"
  >
    <a href="/" class="back-home">
      <span class="arrow">←</span> 首页
    </a>
    <button class="theme-toggle" type="button" :aria-label="darkMode ? '切换至白天模式' : '切换至夜间模式'" :title="darkMode ? '切换至白天模式' : '切换至夜间模式'" :aria-pressed="darkMode" @click.stop="toggleTheme">
      <svg v-if="darkMode" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>
    </button>

    <div ref="header" class="header-section">
      <h1 class="title">星火计划</h1>

      <p class="intro-text">愿景：将该站维护至 2049 年</p>

    <div id="spark-quote" class="danmaku-zone" :class="{ 'is-manual': !quoteAnimated }" @click.stop @pointerenter="holdQuote" @pointerleave="releaseQuote" @focusin="focusQuote" @focusout="blurQuote">
      <Transition :key="manualQuoteRevision" name="quote" mode="out-in" :css="quoteAnimated">
      <div v-if="featuredQuote" :key="quoteIndex" class="danmaku-item" aria-live="polite" aria-atomic="true">
        <span class="danmaku-msg">“{{ featuredQuote.message || '星星之火，可以燎原' }}”</span>
        <span class="danmaku-meta">
          <span class="danmaku-name">{{ featuredQuote.name }}</span>
          <time :datetime="String(featuredQuote.date).replace(/\./g, '-')">{{ featuredQuote.date }}</time>
          <span class="danmaku-impact">+{{ featuredQuote.supportDays }}天</span>
        </span>
      </div>
      </Transition>
      <div v-if="featuredQuote" class="quote-controls">
        <button class="quote-step" aria-label="上一条寄语" @click="stepQuote(-1)">‹</button>
        <button class="quote-step" aria-label="下一条寄语" @click="stepQuote(1)">›</button>
      </div>
    </div>

      <div class="timeline" role="img" :aria-label="`从2025年12月19日到2049年10月1日，已运行${daysRun}天，已支持至${formattedFundedDate}`">
        <div class="timeline-heading">
          <span>已支持至 <strong>{{ shortFundedDate }}</strong></span>
          <span class="timeline-goal">目标 <strong>2049.10.01</strong></span>
        </div>
        <div class="progress-line-bg">
          <div class="progress-line-funded" :style="{ width: fundedPercent + '%' }"></div>
          <div class="funded-marker" :style="{ left: fundedPercent + '%' }"></div>
          <div class="progress-line-active" :style="{ width: progressPercent + '%' }"><div class="glowing-dot"></div></div>
        </div>
        <div class="timeline-caption"><span>2025 起点</span><span><i></i> 今天 · 已运行 {{ daysRun }} 天</span></div>
      </div>

      <div class="impact-stats">
        <div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 5-5 6-5 11a5 5 0 0 0 10 0c0-3-1-5-3-7 0 3-2 4-2 4s2-4 0-8Z"/></svg><strong>{{ donors.length }}</strong><span>颗星火</span></div>
        <span class="stats-divider"></span>
        <div><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg><strong>{{ totalSupportDays }}</strong><span>天续航</span></div>
      </div>

      <div class="action-area">
        <button type="button" class="glass-btn" @click.stop="openDonateQr">
          <span aria-hidden="true">🔥</span> 为网站续航
        </button>
        <p class="micro-impact">¥1 ≈ {{ oneYuanDays }} 天</p>
      </div>
    </div>

    <div class="sparks-field">
      <button
        v-for="(donor, index) in donors"
        :key="JSON.stringify([donor.date, donor.name, donor.amount, donor.message])"
        class="spark-item"
        :style="sparkPositions[index] || { visibility: 'hidden' }"
        :class="{ 'is-active': activeIndex === index }"
        type="button"
        :title="donor.name"
        :aria-label="`${isNewDonor(donor) ? '新点亮的星火，' : ''}查看 ${donor.name} 的星火寄语`"
        :aria-pressed="activeIndex === index"
        aria-controls="spark-detail"
        :aria-expanded="activeIndex === index"
        @mouseenter="hoveredSpark = index"
        @mouseleave="hoveredSpark = -1"
        @focus="hoveredSpark = index"
        @blur="hoveredSpark = -1"
        @keydown.esc="closeAll"
        @click="(e) => toggleSpark(index, e)"
      >
        <div class="fire-wrapper" :style="{ '--fire-scale': donor.scale }">
          <FireLottie :steady="activeIndex === index || hoveredSpark === index" :phase="noise(index, 7)" :visible="sparkPositions[index]?.visibility === 'visible'" />
        </div>
        <span v-if="isNewDonor(donor)" class="spark-new">新</span>

      </button>
    </div>

    <div v-if="activeDonor" id="spark-detail" ref="detailCard" class="spark-card" :style="detailPosition" role="dialog" :aria-label="`${activeDonor.name} 的星火寄语`" @click.stop @keydown.esc="closeAll">
      <span v-if="detailPointer.side !== 'none'" class="detail-pointer" :class="`detail-pointer--${detailPointer.side}`" :style="detailPointer.style" aria-hidden="true"></span>
      <button class="detail-close" type="button" aria-label="关闭寄语卡片" @click="closeAll">×</button>
      <div class="donor-name">@{{ activeDonor.name }}</div>
      <div class="donor-msg">“{{ activeDonor.message || '星星之火，可以燎原' }}”</div>
      <div class="donor-meta"><span>{{ activeDonor.date }}</span><span>¥{{ activeDonor.amount }}（+{{ activeDonor.supportDays }}天）</span></div>
    </div>

    <div v-if="showQR" class="qr-modal" @click="closeDonateModal">
      <div class="pay-panel" role="dialog" aria-label="捐赠" @click.stop>
        <button type="button" class="pay-panel-close" aria-label="关闭" @click="closeDonateModal">×</button>
        <h3 class="pay-panel-title">为网站续航</h3>
        <p class="pay-panel-desc">
          <span>每一份支持都会化作一颗火种<br />你的名字、寄语和续航时间将留在星火墙上</span>
          <span class="pay-cost">（运行成本约 ¥{{ COST_PER_YEAR }}/年）</span>
        </p>
        <div class="qr-duo">
          <div class="qr-slot">
            <div class="qr-art qr-art--wechat">
              <img src="/wechat-pay.jpg" alt="微信收款码" class="qr-img" />
              <span class="qr-label">微信支付</span>
            </div>
          </div>
          <div class="qr-slot">
            <div class="qr-art qr-art--alipay">
              <img src="/alipay-pay.jpg" alt="支付宝收款码" class="qr-img" />
              <span class="qr-label">支付宝支付</span>
            </div>
          </div>
        </div>
        <p class="pay-note">请备注 <strong>【名字+寄语】</strong>，便于登记在星火墙上</p>
        <button type="button" class="close-btn" @click="closeDonateModal">稍后再说</button>
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
.theme-toggle { position: absolute; top: 14px; right: 20px; z-index: 300; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--spark-border); border-radius: 50%; background: var(--spark-card-bg); color: var(--spark-muted); cursor: pointer; }
.theme-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.theme-toggle:hover { color: #c82829; }
.theme-toggle:focus-visible { outline: 2px solid #c82829; outline-offset: 3px; }

.header-section {
  padding-top: 11vh; width: 100%; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 10;
  pointer-events: none;
}
.header-section > :not(.progress-container) { pointer-events: auto; }
.title {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 8px;
  color: var(--spark-text);
  margin: 0 0 15px 0;
  text-align: center;
}

.intro-text { margin: 0 0 22px; color: var(--spark-muted); font-family: "Songti SC", "SimSun", serif; font-size: 15px; letter-spacing: 2px; }
.timeline { width: min(420px, calc(100vw - 64px)); margin-bottom: 30px; }
.timeline-heading, .timeline-caption { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; font-size: 11px; color: var(--spark-muted); }
.timeline-heading { margin-bottom: 18px; }
.timeline-heading strong { display: block; margin-top: 6px; font-weight: 500; font-size: 19px; letter-spacing: 1px; color: var(--spark-text); }
.timeline-goal { text-align: right; }
.timeline-caption { margin-top: 14px; font-size: 10px; }
.timeline-caption i { display: inline-block; width: 5px; height: 5px; margin-right: 4px; border-radius: 50%; background: #c82829; }
.funded-marker { position: absolute; top: -3px; width: 2px; height: 8px; background: #d99659; }
.impact-stats { display: flex; gap: 24px; align-items: center; margin-bottom: 28px; }
.impact-stats > div { display: flex; align-items: baseline; gap: 7px; }
.impact-stats svg { width: 17px; height: 17px; fill: none; stroke: #b37e4b; stroke-width: 1.4; align-self: center; }
.impact-stats strong { font-size: 25px; font-weight: 400; }
.impact-stats span { font-size: 11px; color: var(--spark-muted); }
.stats-divider { height: 22px; width: 1px; background: var(--spark-border); }

/* 进度条 */
.progress-container { width: 100%; display: flex; justify-content: center; margin-bottom: 35px; }
.progress-line-bg {
  width: 100%;
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
  font-family: inherit;
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
.action-area {
  position: relative;
  z-index: 21;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.micro-impact {
  margin: 9px 0 0;
  color: var(--spark-muted);
  font-size: 11px;
  letter-spacing: 0.5px;
}
.support-summary {
  margin: 0 20px 18px;
  color: var(--spark-muted);
  font-family: "Songti SC", "SimSun", serif;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

/* 星火区 */
.sparks-field {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  background:
    radial-gradient(ellipse at 20% 43%, rgba(218, 135, 63, 0.025), transparent 32%),
    radial-gradient(ellipse at 79% 58%, rgba(218, 135, 63, 0.025), transparent 30%);
}
.spark-item {
  position: absolute;
  width: 44px;
  height: 44px;
  margin: -22px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
}
.spark-item:hover, .spark-item:focus-visible, .spark-item.is-active { z-index: 2; }
.spark-item:focus-visible { outline: 1px solid #c82829; outline-offset: 6px; border-radius: 50%; }
.spark-new { position: absolute; left: 29px; top: 1px; padding: 1px 4px; border-radius: 5px; background: #b72228; color: #fff; font-size: 9px; line-height: 14px; box-shadow: 0 1px 4px rgba(120, 20, 20, 0.15); pointer-events: none; }

.fire-wrapper {
  width: var(--ember-size);
  height: var(--ember-size);
  opacity: 1;
  transform: scale(var(--fire-scale));
  pointer-events: none;
}

.fire-wrapper { filter: drop-shadow(0 1px 3px rgba(222, 123, 40, 0.18)); transition: filter 0.2s; }
.spark-item:hover .fire-wrapper,
.spark-item:focus-visible .fire-wrapper,
.spark-item.is-active .fire-wrapper { opacity: 1 !important; animation-play-state: paused; filter: drop-shadow(0 0 5px rgba(226, 121, 35, 0.5)); }

/* 固定位置的单条寄语，不再有横向运动或多卡片叠加。 */
.danmaku-zone {
  position: relative;
  width: min(420px, calc(100vw - 64px));
  height: 120px;
  padding: 12px 28px 22px;
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.danmaku-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 100%;
  font-size: 13px;
  color: var(--spark-muted);
}
.danmaku-msg {
  color: #b72228;
  font-family: "Songti SC", "SimSun", serif;
  font-weight: 600;
  letter-spacing: 0.4px;
  max-width: 100%;
  white-space: normal;
  text-align: center;
  font-size: 18px;
  line-height: 1.6;
  max-height: 64px;
  overflow-y: auto;
  pointer-events: auto;
}
.danmaku-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: var(--spark-muted);
  font-size: 12px;
}
.danmaku-name {
  font-weight: 400;
}
.danmaku-impact {
  color: var(--spark-muted);
  font-weight: 400;
}
.quote-controls { position: absolute; inset: 0; pointer-events: none; }
.quote-step { position: absolute; top: 26px; left: -6px; pointer-events: auto; width: 28px; height: 28px; border: 0; background: none; color: var(--spark-muted); opacity: 0.4; cursor: pointer; font-size: 18px; }
.quote-step:last-child { left: auto; right: -6px; }
.quote-step:hover { color: #c82829; }
.spark-universe--dark .danmaku-msg { color: #ff958c; }
.quote-leave-active { transition: opacity 0.8s ease-in-out; }
.quote-enter-active { transition: opacity 0.7s ease-in-out; }
.quote-leave-to, .quote-enter-from { opacity: 0; }
.is-manual .quote-leave-active { display: none; }

@media (prefers-reduced-motion: reduce) {
  .fire-wrapper,
  .fire-core,
  .danmaku-item {
    animation: none !important;
  }
  .quote-enter-active, .quote-leave-active { transition: none; }
  .fire-wrapper { transform: scale(var(--fire-scale)); }
}

.spark-card { --detail-bg: rgba(250, 249, 247, 0.96); --detail-border: rgba(126, 103, 82, 0.14); position: fixed; z-index: 40; width: 220px; max-width: calc(100vw - 24px); padding: 14px 16px 13px; border: 1px solid var(--detail-border); border-radius: 10px; background: var(--detail-bg); backdrop-filter: blur(12px); box-shadow: 0 4px 18px rgba(35, 29, 23, 0.06); animation: detail-appear 0.16s ease-out; }
.spark-universe--dark .spark-card { --detail-bg: rgba(29, 28, 27, 0.96); --detail-border: rgba(230, 211, 189, 0.12); }
@keyframes detail-appear { from { opacity: 0; } to { opacity: 1; } }
.detail-pointer { position: absolute; width: 10px; height: 10px; background: var(--detail-bg); border: 1px solid var(--detail-border); transform: rotate(45deg); pointer-events: none; }
.detail-pointer--top { top: -6px; border-right: 0; border-bottom: 0; }
.detail-pointer--bottom { bottom: -6px; border-left: 0; border-top: 0; }
.detail-pointer--left { left: -6px; border-right: 0; border-top: 0; }
.detail-pointer--right { right: -6px; border-left: 0; border-bottom: 0; }
.detail-close { position: absolute; right: 5px; top: 5px; width: 24px; height: 24px; border: 0; background: none; color: var(--spark-muted); opacity: 0.5; font-size: 16px; cursor: pointer; }
.detail-close:hover { opacity: 1; }
.donor-name { padding-right: 18px; font-size: 11px; color: var(--spark-muted); font-weight: 400; margin-bottom: 8px; }
.donor-msg { color: #b72228; font-family: "Songti SC", serif; font-size: 15px; font-weight: 600; line-height: 1.65; overflow-wrap: anywhere; }
.donor-meta { display: flex; justify-content: space-between; gap: 8px; color: var(--spark-muted); font-size: 10px; margin-top: 12px; opacity: 0.8; }
.spark-universe--dark .donor-msg { color: #ff958c; }

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
.pay-panel-desc .pay-cost { font-size: 13px; }
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
.qr-art { position: relative; width: 100%; aspect-ratio: 1; flex-shrink: 0; container-type: inline-size; }
.qr-art--wechat { --qr-color: #07c060; }
.qr-art--alipay { --qr-color: #1777ff; }
.qr-label { position: absolute; inset: 0 0 auto; height: 23%; display: flex; align-items: center; justify-content: center; background: var(--qr-color); color: white; font-family: "Songti SC", "SimSun", serif; font-size: clamp(12px, 7cqw, 18px); font-weight: 600; letter-spacing: 1px; line-height: 1; }
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
  .header-section { padding-top: 8vh; }
  .title { font-size: 1.8rem; letter-spacing: 5px; }
  .intro-text { font-size: 14px; }
  .intro-text { margin-bottom: 24px; }
  .timeline { margin-bottom: 24px; }
  .impact-stats { margin-bottom: 24px; gap: 18px; }
  .intro-box, .time-stats, .progress-container, .action-area { display: flex; justify-content: center; }
  .support-summary { max-width: 320px; }
  .danmaku-item {
    font-size: 12px;
  }
  .danmaku-zone { height: 112px; margin-bottom: 24px; padding: 12px 24px 22px; }
  .danmaku-msg { font-size: 16px; max-height: 56px; }
  .danmaku-meta { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .spark-card { animation: none; }
}
</style>
