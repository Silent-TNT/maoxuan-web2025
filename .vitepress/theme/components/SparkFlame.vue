<template>
  <span class="spark-flame" aria-hidden="true"></span>
</template>

<style scoped>
.spark-flame {
  display: block;
  width: 100%;
  height: 100%;
  background: url('/animations/fire-still.svg') center / contain no-repeat;
  transform-origin: 50% 68%;
  animation: burn 4s var(--flame-delay, 0s) ease-in-out infinite;
}

@keyframes burn {
  0%, 100% { transform: scale(0.96, 1.04) skewX(-4deg); }
  50% { transform: scale(1.04, 0.96) skewX(4deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spark-flame { animation: none; }
}
</style>
