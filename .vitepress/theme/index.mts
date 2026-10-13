// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent, h } from 'vue'
import './style.css'
import SidebarCurrentArticle from './components/SidebarCurrentArticle.vue'
import ReadingSettings from './components/ReadingSettings.vue'
import { trackPageview } from './baidu-tongji.mjs'
import { setupReadingPosition } from './reading-position.mjs'

// 阅读导航先初始化，附加功能独立加载，避免阻塞手机端目录交互。
const ShareCard = defineAsyncComponent(() => import('./components/ShareCard.vue'))
const Spark2049 = defineAsyncComponent(() => import('./components/Spark2049.vue'))
const DailyQuote = defineAsyncComponent(() => import('./components/DailyQuote.vue'))
const AiChat = defineAsyncComponent(() => import('./components/AiChat.vue'))
const MarginNotes = defineAsyncComponent(() => import('./components/MarginNotes.vue'))

export default {
  extends: DefaultTheme,

  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(ReadingSettings),
      'layout-bottom': () => [
        h(ShareCard),
        h(AiChat, { mode: 'float' }),
        h(SidebarCurrentArticle),
      ],

      'aside-outline-before': () => h(MarginNotes),

      // 用数组把每日一句和极简版聊天入口包起来
      'home-hero-after': () => [
        h(DailyQuote),
        h(AiChat, { mode: 'inline' }),
      ],
    })
  },

  enhanceApp({ app, router }) {
    app.component('ShareCard', ShareCard)
    app.component('Spark2049', Spark2049)
    app.component('DailyQuote', DailyQuote)
    app.component('AiChat', AiChat)
    app.component('MarginNotes', MarginNotes)
    app.component('SidebarCurrentArticle', SidebarCurrentArticle)

    setupReadingPosition(router, {
      onRouteChanged: (to) => trackPageview(to || undefined),
    })
  },
}
