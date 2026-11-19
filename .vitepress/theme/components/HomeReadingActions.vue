<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { VPButton } from 'vitepress/theme'
import { getLastReadPath, toDocumentPath } from '../reading-position.mjs'

const { theme } = useData()
const firstArticle = toDocumentPath('/第一卷/001-中国社会各阶级的分析')
const lastRead = ref<{ link: string; volume: string; title: string } | null>(null)

function refreshLastRead() {
  lastRead.value = null
  const path = getLastReadPath()
  const sidebar = theme.value.sidebar
  if (!path || !Array.isArray(sidebar)) return

  let decodedPath: string
  try {
    decodedPath = decodeURI(path)
  } catch {
    return
  }

  for (const volume of sidebar) {
    const article = volume.items?.find((item) => item.link === decodedPath)
    if (article?.link && article.text && volume.text) {
      lastRead.value = {
        link: toDocumentPath(article.link),
        volume: volume.text,
        title: article.text,
      }
      return
    }
  }
}

onMounted(() => {
  refreshLastRead()
  window.addEventListener('pageshow', refreshLastRead)
})
onBeforeUnmount(() => window.removeEventListener('pageshow', refreshLastRead))
</script>

<template>
  <div class="home-reading-actions">
    <VPButton
      :href="lastRead?.link ?? firstArticle"
      :text="lastRead ? '继续阅读' : '开始阅读'"
      :aria-describedby="lastRead ? 'last-read-article' : undefined"
    />
    <VPButton href="/favorites" theme="alt" text="我的书签" />
    <VPButton href="/donate" theme="alt" text="🔥星火计划2049" />
  </div>
  <p v-if="lastRead" id="last-read-article">
    {{ lastRead.volume }} · {{ lastRead.title }}
  </p>
</template>

<style scoped>
.home-reading-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 24px;
}

#last-read-article {
  margin-top: 10px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (width < 640px) {
  .home-reading-actions {
    flex-wrap: nowrap;
    gap: clamp(6px, 2vw, 10px);
  }

  .home-reading-actions > .VPButton.medium {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding-inline: clamp(7px, 2.25vw, 12px);
    font-size: 13px;
    line-height: normal;
    letter-spacing: normal;
  }
}

@media (min-width: 640px) {
  .home-reading-actions {
    padding-top: 32px;
  }
}
</style>
