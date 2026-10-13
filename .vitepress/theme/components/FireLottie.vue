<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import fireData from '../assets/fire.json'

const props = defineProps({ phase: { type: Number, default: 0 }, visible: { type: Boolean, default: true }, steady: Boolean })
const container = ref(null)
let animation = null
let motion = null
let disposed = false
let frameRequest = 0
let previousTime = 0
let elapsed = 0

// 原素材包含点燃和熄灭。往返播放完整燃烧区间，端点速度为零，避免循环跳帧。
function renderFlame() {
  const phase = props.phase * Math.PI * 2 + elapsed / 4000 * Math.PI * 2
  animation.goToAndStop(9.5 + Math.sin(phase) * 4.5, true)
}
function tick(time) {
  elapsed += previousTime ? Math.min(time - previousTime, 48) : 0
  previousTime = time
  renderFlame()
  frameRequest = requestAnimationFrame(tick)
}
function syncPlayback() {
  cancelAnimationFrame(frameRequest)
  previousTime = 0
  if (!animation) return
  if (motion.matches) animation.goToAndStop(8, true)
  else if (!document.hidden && props.visible && !props.steady) frameRequest = requestAnimationFrame(tick)
}

watch(() => [props.visible, props.steady], syncPlayback)

onMounted(async () => {
  const { default: lottie } = await import('lottie-web/build/player/lottie_light')
  if (disposed) return
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  animation = lottie.loadAnimation({
    container: container.value,
    renderer: 'svg', loop: true, autoplay: false,
    animationData: structuredClone(fireData),
    rendererSettings: { progressiveLoad: true, preserveAspectRatio: 'xMidYMid meet' },
  })
  renderFlame()
  motion.addEventListener('change', syncPlayback)
  document.addEventListener('visibilitychange', syncPlayback)
  syncPlayback()
})

onUnmounted(() => {
  disposed = true
  cancelAnimationFrame(frameRequest)
  motion?.removeEventListener('change', syncPlayback)
  document.removeEventListener('visibilitychange', syncPlayback)
  animation?.destroy()
})
</script>

<template>
  <span class="fire-art" aria-hidden="true">
    <span ref="container" class="lottie-fire"></span>
  </span>
</template>

<style scoped>
.fire-art { display: block; position: relative; width: 100%; height: 100%; pointer-events: none; }
.lottie-fire { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; }
</style>
