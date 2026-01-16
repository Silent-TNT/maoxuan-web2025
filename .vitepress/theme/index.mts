// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import Spark2049 from './components/Spark2049.vue'
import ShareCard from './components/ShareCard.vue' // <--- 引入卡片组件

export default {
  extends: DefaultTheme,
  
  // 使用 Layout 插槽，把组件全局挂载
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // 这里的 layout-bottom 意味着把这些组件放到页面结构的最下层
      // 这样它们作为弹窗或全屏层时，能覆盖在内容之上
      'layout-bottom': () => [
        h(Spark2049), // 你的星火计划组件
        h(ShareCard)  // <--- 你的金句卡片组件
      ]
    })
  },
  
  enhanceApp({ app }) {
    app.component('Spark2049', Spark2049)
    app.component('ShareCard', ShareCard)
  }
}