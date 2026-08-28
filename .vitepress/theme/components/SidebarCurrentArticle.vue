<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { inBrowser, onContentUpdated, useRoute } from 'vitepress'

const route = useRoute()
let frame = 0
let lastArticlePath = ''

const articlePath = () => {
  try {
    return decodeURI(route.path).split('#')[0]
  } catch {
    return route.path.split('#')[0]
  }
}

const isArticlePage = (path: string) =>
  /^\/(第一卷|第二卷|第三卷|第四卷)\//.test(path)

const setCollapsed = (item: HTMLElement, collapsed: boolean) => {
  if (item.classList.contains('collapsed') === collapsed) return
  item.querySelector<HTMLElement>(':scope > .item > .caret')?.click()
}

const revealCurrentArticle = (item: HTMLElement) => {
  const sidebar = item.closest<HTMLElement>('.VPSidebar')
  if (!sidebar) return

  const sidebarRect = sidebar.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const comfortableTop = sidebarRect.top + Math.min(180, sidebar.clientHeight * 0.28)
  const comfortableBottom = sidebarRect.bottom - 120

  if (itemRect.top < comfortableTop || itemRect.bottom > comfortableBottom) {
    const targetTop = sidebar.scrollTop + itemRect.top - comfortableTop
    sidebar.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' })
  }
}

const syncSidebar = async () => {
  cancelAnimationFrame(frame)
  await nextTick()
  frame = requestAnimationFrame(() => {
    const path = articlePath()
    if (!isArticlePage(path)) return

    const articleItems = Array.from(
      document.querySelectorAll<HTMLElement>('.VPSidebarItem.level-1.collapsible')
    )
    if (articleItems.length === 0) return

    let currentItem: HTMLElement | undefined
    articleItems.forEach((item) => {
      const active = item.classList.contains('is-active') || item.classList.contains('has-active')
      setCollapsed(item, !active)
      if (active) currentItem = item
    })

    if (currentItem && path !== lastArticlePath) revealCurrentArticle(currentItem)
    lastArticlePath = path
  })
}

onMounted(syncSidebar)
onContentUpdated(syncSidebar)
watch(() => route.path, syncSidebar)

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template></template>
