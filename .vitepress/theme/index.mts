// .vitepress/theme/index.mts
import DefaultTheme from 'vitepress/theme'
import './style.css' // <--- 重点是这行，引入了我们刚才写的样式

export default {
  extends: DefaultTheme
}