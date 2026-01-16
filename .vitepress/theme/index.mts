// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import Spark2049 from './components/Spark2049.vue'
import ShareCard from './components/ShareCard.vue'

export default {
  extends: DefaultTheme,
  
  // 修正：这里只放 ShareCard，千万不要放 Spark2049
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(ShareCard) 
    })
  },
  
  enhanceApp({ app }) {
    // 组件依然要注册，这样你在 donate.md 里写 <Spark2049 /> 才能生效
    app.component('Spark2049', Spark2049)
    app.component('ShareCard', ShareCard)
  }
}