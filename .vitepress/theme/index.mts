// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import './style.css' // 引入样式
import DonorWall from './components/DonorWall.vue' // 引入星火墙组件

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 注册星火墙组件
    app.component('DonorWall', DonorWall)
  }
}