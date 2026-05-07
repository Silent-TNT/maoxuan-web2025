// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import ShareCard from './components/ShareCard.vue'
import Spark2049 from './components/Spark2049.vue'
import DailyQuote from './components/DailyQuote.vue'
import ChairmanChat from './components/ChairmanChat.vue' // <--- 1. 新增引入教员聊天组件

export default {
  extends: DefaultTheme,
  
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // 👇👇👇 修改这里：用中括号 [] 把两个组件包起来，让它们共存
      'layout-bottom': () => [h(ShareCard), h(ChairmanChat)],
      
      'home-hero-after': () => h(DailyQuote)
    })
  },
  
  enhanceApp({ app }) {
    app.component('ShareCard', ShareCard)
    app.component('Spark2049', Spark2049)
    app.component('DailyQuote', DailyQuote)
    app.component('ChairmanChat', ChairmanChat) // <--- 2. 顺手把它也全局注册一下
  }
}