<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const STORAGE_KEY = 'maoxuan-reading-font-size-v1'
const DEFAULT_SIZE = 20
const MIN_SIZE = 16
const MAX_SIZE = 28
const route = useRoute()
const fontSize = ref(DEFAULT_SIZE)
const panel = ref<HTMLDetailsElement>()
const isArticle = computed(() => {
  try {
    return /^\/(第一卷|第二卷|第三卷|第四卷)\//.test(decodeURI(route.path))
  } catch {
    return false
  }
})

function applySize(size: number, keepPosition = false) {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) return
  // 保留当前可见段落，避免调整字号后正在阅读的内容跳走。
  const anchor = keepPosition
    ? Array.from(document.querySelectorAll<HTMLElement>('.VPDoc .vp-doc p, .VPDoc .vp-doc li'))
        .find((element) => element.getBoundingClientRect().bottom > 120 && element.getBoundingClientRect().top < window.innerHeight)
    : undefined
  const previousTop = anchor?.getBoundingClientRect().top
  const root = document.documentElement
  const previousAnchoring = root.style.overflowAnchor
  if (anchor) root.style.overflowAnchor = 'none'
  fontSize.value = size
  root.style.setProperty('--reading-font-size', `${size}px`)
  if (anchor && previousTop !== undefined) {
    window.scrollBy({ top: anchor.getBoundingClientRect().top - previousTop, behavior: 'instant' })
    requestAnimationFrame(() => { root.style.overflowAnchor = previousAnchoring })
  }
}

function changeSize(size: number) {
  applySize(size, true)
  try {
    localStorage.setItem(STORAGE_KEY, String(fontSize.value))
  } catch {
    // 无法使用本地存储时，仍然允许在当前页面调整。
  }
}

function closePanel() {
  if (panel.value) panel.value.open = false
}

function onOutsideClick(event: PointerEvent) {
  if (panel.value && !panel.value.contains(event.target as Node)) closePanel()
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && panel.value?.open) {
    closePanel()
    panel.value.querySelector('summary')?.focus()
  }
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) applySize(Number(saved))
  } catch {
    // 使用默认字号。
  }
  document.addEventListener('pointerdown', onOutsideClick)
  document.addEventListener('keydown', onEscape)
})

watch(() => route.path, closePanel)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsideClick)
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <details v-if="isArticle" ref="panel" class="reading-settings">
    <summary aria-label="阅读字号设置" title="调整阅读字号">
      <span aria-hidden="true">Aa</span>
      <span class="reading-settings-label">字号</span>
    </summary>
    <div class="reading-settings-panel" role="group" aria-label="阅读字号">
      <div class="reading-settings-heading">
        <label for="reading-font-size">文字大小</label>
        <output for="reading-font-size" aria-live="polite">{{ fontSize }}px</output>
      </div>
      <div class="reading-settings-controls">
        <button type="button" aria-label="缩小文字" :disabled="fontSize <= MIN_SIZE" @click="changeSize(fontSize - 2)">A−</button>
        <input
          id="reading-font-size"
          type="range"
          :min="MIN_SIZE"
          :max="MAX_SIZE"
          step="2"
          :value="fontSize"
          :aria-valuetext="`${fontSize} 像素`"
          @input="changeSize(Number(($event.target as HTMLInputElement).value))"
        />
        <button type="button" aria-label="放大文字" :disabled="fontSize >= MAX_SIZE" @click="changeSize(fontSize + 2)">A+</button>
      </div>
      <div class="reading-settings-footer">
        <span>自动记住你的选择</span>
        <button type="button" @click="changeSize(DEFAULT_SIZE)">恢复默认</button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.reading-settings { position: relative; margin-left: 12px; }
summary { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 8px; border-radius: 8px; color: var(--vp-c-text-1); cursor: pointer; list-style: none; font-size: 14px; }
summary::-webkit-details-marker { display: none; }
summary > span:first-child { font-size: 19px; font-weight: 600; }
summary:hover, .reading-settings[open] summary { background: var(--vp-c-bg-soft); color: var(--vp-c-brand-1); }
summary:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.reading-settings-panel { position: absolute; top: calc(100% + 8px); right: 0; width: min(280px, calc(100vw - 32px)); padding: 18px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-elv); box-shadow: var(--vp-shadow-3); white-space: normal; }
.reading-settings-heading, .reading-settings-controls, .reading-settings-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.reading-settings-heading { font-size: 14px; font-weight: 600; }
output { color: var(--vp-c-brand-1); font-variant-numeric: tabular-nums; }
.reading-settings-controls { margin: 14px 0; }
.reading-settings-controls button { flex-shrink: 0; width: 44px; height: 44px; border-radius: 8px; background: var(--vp-c-bg-soft); font-size: 17px; }
button { cursor: pointer; }
button:hover:not(:disabled) { color: var(--vp-c-brand-1); }
button:disabled { opacity: 0.35; cursor: default; }
input { width: 100%; min-width: 0; height: 44px; accent-color: var(--vp-c-brand-1); cursor: pointer; }
.reading-settings-footer { color: var(--vp-c-text-2); font-size: 12px; }
.reading-settings-footer button { min-height: 32px; color: var(--vp-c-brand-1); }
@media (max-width: 767px) {
  .reading-settings { margin-left: 4px; }
  .reading-settings-label { display: none; }
  .reading-settings-panel { position: fixed; top: calc(var(--vp-nav-height) + 8px); right: 16px; }
}
</style>
