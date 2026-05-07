// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import ShareCard from './components/ShareCard.vue'
import Spark2049 from './components/Spark2049.vue'
import DailyQuote from './components/DailyQuote.vue'
import AiChat from './components/AiChat.vue'

export default {
  extends: DefaultTheme,
  
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => [
        h(ShareCard),
        h(AiChat, { mode: 'float' }) 
      ],
      
      // 👇 用数组把每日一句和极简版聊天入口包起来
      'home-hero-after': () => [
        h(DailyQuote), 
        h(AiChat, { mode: 'inline' })
      ]
    })
  },
  
  enhanceApp({ app }) {
    app.component('ShareCard', ShareCard)
    app.component('Spark2049', Spark2049)
    app.component('DailyQuote', DailyQuote)
    app.component('AiChat', AiChat)
  }
}