<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import fireData from '../assets/fire.json'

const props = defineProps({ phase: { type: Number, default: 0 }, visible: { type: Boolean, default: true }, steady: Boolean })
const container = ref(null)
const continuity = ref(null)
let animation = null
let motion = null
let disposed = false

function syncContinuity() {
  if (!animation || !continuity.value) return
  const frame = animation.currentFrame
  const opacity = frame < 2 ? 1 - frame / 2 : frame < 14 ? 0 : Math.min(1, (frame - 14) / 7)
  continuity.value.style.opacity = String(opacity)
}

function syncPlayback() {
  if (!animation) return
  if (motion.matches) animation.goToAndStop(8, true)
  else if (document.hidden || !props.visible || props.steady) animation.pause()
  else animation.play()
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
  animation.addEventListener('enterFrame', syncContinuity)
  // 播放原素材的全部帧，只降低时间推进速度；保留完整的燃烧形变。
  animation.goToAndStop(Math.floor(props.phase * animation.totalFrames), true)
  animation.setSpeed(0.4)
  motion.addEventListener('change', syncPlayback)
  document.addEventListener('visibilitychange', syncPlayback)
  syncPlayback()
})

onUnmounted(() => {
  disposed = true
  motion?.removeEventListener('change', syncPlayback)
  document.removeEventListener('visibilitychange', syncPlayback)
  animation?.destroy()
})
</script>

<template>
  <span class="fire-art" aria-hidden="true">
    <img ref="continuity" class="fire-continuity" src="/animations/fire-still.svg" alt="" />
    <span ref="container" class="lottie-fire"></span>
  </span>
</template>

<style scoped>
.fire-art { display: block; position: relative; width: 100%; height: 100%; pointer-events: none; }
.lottie-fire, .fire-continuity { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; }
</style>
