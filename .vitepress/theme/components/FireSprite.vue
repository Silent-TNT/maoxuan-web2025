<script setup>
defineProps({ phase: { type: Number, default: 0 }, visible: { type: Boolean, default: true } })
</script>

<template>
  <span
    class="lpc-fire"
    aria-hidden="true"
    :style="{ animationDelay: `${-phase * 1.2}s`, animationPlayState: visible ? 'running' : 'paused' }"
  ></span>
</template>

<style scoped>
/* 原图 64×72：4 列、3 行，共 12 个 16×24 的透明帧。 */
.lpc-fire {
  display: block;
  width: 16px;
  height: 24px;
  background: url('/animations/lpc-flames.png') 0 0 / 64px 72px no-repeat;
  image-rendering: pixelated;
  animation: lpc-burn 1.2s steps(1, end) infinite;
  pointer-events: none;
}
@keyframes lpc-burn {
  0%, 100% { background-position: 0 0; }
  8.333% { background-position: -16px 0; }
  16.667% { background-position: -32px 0; }
  25% { background-position: -48px 0; }
  33.333% { background-position: 0 -24px; }
  41.667% { background-position: -16px -24px; }
  50% { background-position: -32px -24px; }
  58.333% { background-position: -48px -24px; }
  66.667% { background-position: 0 -48px; }
  75% { background-position: -16px -48px; }
  83.333% { background-position: -32px -48px; }
  91.667% { background-position: -48px -48px; }
}
@media (prefers-reduced-motion: reduce) {
  .lpc-fire { animation: none; background-position: -16px -24px; }
}
</style>
