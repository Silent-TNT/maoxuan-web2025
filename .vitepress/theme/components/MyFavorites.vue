<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { favoriteLink, readFavorites, saveFavorites, watchFavorites } from '../favorites.mjs'

const props = defineProps<{ inDrawer?: boolean; active?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const rows = ref<ReturnType<typeof readFavorites>>([])
const message = ref('')
const list = ref<HTMLElement>()
const heading = ref<HTMLElement>()
const section = ref<HTMLElement>()
let stopWatching: (() => void) | undefined

function refresh() {
  rows.value = readFavorites()
}

function followFavorite(event: MouseEvent) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  emit('navigate')
  const link = event.currentTarget as HTMLAnchorElement
  if (link.href === window.location.href) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

async function removeFavorite(id: string, index: number) {
  const next = readFavorites().filter((entry) => entry.id !== id)
  if (!saveFavorites(next)) {
    message.value = '此浏览器暂时无法修改书签'
    return
  }
  rows.value = next
  message.value = '已移除书签'
  await nextTick()
  const links = list.value?.querySelectorAll<HTMLElement>('.favorite-entry-link')
  const nextLink = links?.[Math.min(index, links.length - 1)]
  const nextFocus = nextLink ?? heading.value ?? section.value
  nextFocus?.focus()
}

onMounted(() => {
  refresh()
  stopWatching = watchFavorites(refresh)
})
watch(() => props.active, (active) => {
  if (active) refresh()
})
onBeforeUnmount(() => stopWatching?.())
</script>

<template>
  <section ref="section" class="favorites-page" :class="{ 'in-drawer': inDrawer }" tabindex="-1">
    <h1 v-if="!inDrawer" ref="heading" tabindex="-1">我的书签</h1>
    <p class="favorites-caption">书签保存在当前浏览器。</p>
    <ul v-if="rows.length" ref="list" class="favorites-list">
      <li v-for="(favorite, index) in rows" :key="favorite.id" class="favorite-entry">
        <a class="favorite-entry-link" :href="withBase(favoriteLink(favorite))" @click="followFavorite">
          <span class="favorite-entry-text">{{ favorite.text }}</span>
          <span class="favorite-entry-source">{{ favorite.path.split('/')[1] }} · {{ favorite.title }}</span>
        </a>
        <button
          type="button"
          :aria-label="`删除书签：${favorite.text.slice(0, 24)}`"
          @click="removeFavorite(favorite.id, index)"
        >删除</button>
      </li>
    </ul>
    <p v-else class="favorites-empty">还没有书签。阅读时可添加段落书签，也可选中文字后点「划线」。</p>
    <span class="visually-hidden" role="status">{{ message }}</span>
  </section>
</template>

<style scoped>
.favorites-page {
  max-width: 808px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}
.favorites-page.in-drawer { padding: 18px 24px calc(24px + env(safe-area-inset-bottom, 0px)); }
.in-drawer .favorites-caption { margin: 0 0 16px; }
.in-drawer .favorite-entry-text { font-size: 15px; }

h1 {
  font-size: clamp(28px, 5vw, 36px);
  line-height: 1.25;
  font-weight: 700;
}

.favorites-caption,
.favorite-entry-source,
.favorites-empty {
  color: var(--vp-c-text-2);
}

.favorites-caption {
  margin: 10px 0 26px;
  font-size: 14px;
}

.favorite-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.favorite-entry:last-child {
  border-bottom: 1px solid var(--vp-c-divider);
}

.favorite-entry-link {
  flex: 1;
  min-width: 0;
  padding: 16px 0;
}

.favorite-entry-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  font-size: 17px;
  line-height: 1.6;
}

.favorite-entry-source {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
}

.favorite-entry button {
  min-height: 44px;
  padding: 0 8px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  font-size: 13px;
  border-radius: 6px;
}

.favorite-entry-link:hover,
.favorite-entry button:hover {
  color: var(--vp-c-brand-1);
}
</style>
