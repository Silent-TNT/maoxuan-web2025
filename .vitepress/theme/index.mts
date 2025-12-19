// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import './style.css'
import Spark2049 from './components/Spark2049.vue' // <--- 引入新组件

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Spark2049', Spark2049) // <--- 注册它
  }
}