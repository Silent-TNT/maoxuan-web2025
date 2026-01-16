// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import ShareCard from './components/ShareCard.vue'
import Spark2049 from './components/Spark2049.vue'
import DailyQuote from './components/DailyQuote.vue' // <--- 1. 引入新组件

export default {
  extends: DefaultTheme,
  
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // 保留原来的全局卡片
      'layout-bottom': () => h(ShareCard),
      
      // 👇👇👇 新增：把每日一句插到首页 Hero 下方 👇👇👇
      'home-hero-after': () => h(DailyQuote)
    })
  },
  
  enhanceApp({ app }) {
    app.component('ShareCard', ShareCard)
    app.component('Spark2049', Spark2049)
    // 注册 DailyQuote (虽然这里 Layout 用了，注册一下也没坏处)
    app.component('DailyQuote', DailyQuote)
  }
}