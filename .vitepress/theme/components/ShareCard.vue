<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()

let html2canvas = null
const visible = ref(false)
const showModal = ref(false)
const buttonStyle = ref({ top: '0px', left: '0px' })
const quote = ref('')
const generating = ref(false)
const cardImage = ref(null)

const handleSelection = () => {
  if (showModal.value) return

  const selection = window.getSelection()
  let text = selection.toString().trim()

  // 🔴 核弹级清洗正则：
  // 1. [\(（\[【] : 匹配所有类型的左括号
  // 2. \s* : 允许括号内有空格
  // 3. \d+ : 匹配数字
  // 4. [\)）\]】] : 匹配所有类型的右括号
  // 5. |[⑴-⒇] : 额外匹配特殊序号字符 (如 ⑴, ⑵...)
  text = text.replace(/([\(（\[【]\s*\d+\s*[\)）\]】]|[⑴-⒇])/g, '')

  if (text.length > 5 && text.length < 1500) { 
    quote.value = text
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    buttonStyle.value = {
      top: `${window.scrollY + rect.top - 45}px`,
      left: `${rect.left + (rect.width / 2) - 50}px`
    }
    visible.value = true
  } else {
    visible.value = false
  }
}

const generateCard = async () => {
  if (!html2canvas) {
    try {
      html2canvas = (await import('html2canvas')).default
    } catch (e) {
      console.error("插件加载失败", e)
      return
    }
  }
  
  visible.value = false
  showModal.value = true
  generating.value = true
  cardImage.value = null

  await nextTick()
  
  const element = document.getElementById('poster-node')
  
  if (element) {
    element.style.display = 'block'
    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: '#1a1a1a',
        scale: 3,
        scrollY: 0,
        scrollX: 0,
      })
      cardImage.value = canvas.toDataURL('image/png')
    } catch (e) {
      console.error('生成失败', e)
    } finally {
      generating.value = false
      element.style.display = 'none'
    }
  } else {
    generating.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  cardImage.value = null
  window.getSelection().removeAllRanges()
}

onMounted(() => {
  document.addEventListener('mouseup', handleSelection)
  document.addEventListener('touchend', (e) => {
    if (e.target.closest('.float-btn')) return
    setTimeout(handleSelection, 100)
  })
})

onUnmounted(() => {
  document.removeEventListener('mouseup', handleSelection)
  document.removeEventListener('touchend', handleSelection)
})
</script>

<template>
  <div class="share-wrapper">
    <div 
      v-if="visible" 
      class="float-btn" 
      :style="buttonStyle"
      @mousedown.prevent="generateCard" 
      @touchstart.prevent="generateCard"
    >
      <span class="icon">🖼️</span> 生成金句卡片
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="closeModal">
      <div class="modal-content">
        <div id="poster-node" class="poster-card" style="display: none;">
          <div class="poster-header">“</div>
          <div class="poster-body">{{ quote }}</div>
          
          <div class="poster-footer">
            <div class="footer-info">
              <div class="main-author">毛泽东选集</div>
              
              <div class="sub-source">{{ page.title }}</div>
              
              <div class="site">xuemaoxuan.com · 学毛选</div>
            </div>
          </div>
          
          <div class="noise-bg"></div>
        </div>

        <div class="result-area" v-if="!generating && cardImage">
          <h3 class="tip-text">长按图片保存分享</h3>
          <img :src="cardImage" class="final-img" alt="分享卡片">
          <button class="close-btn" @click="closeModal">关闭</button>
        </div>
        
        <div v-if="generating" class="loading-box">
          <div class="loading-spinner"></div>
          <p>正在绘制精美卡片...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 悬浮按钮及通用样式保持不变 */
.float-btn {
  position: absolute; z-index: 1000;
  background: #d22b2b; color: #fff; padding: 8px 16px;
  border-radius: 50px; font-size: 13px; font-weight: bold;
  cursor: pointer; box-shadow: 0 4px 15px rgba(210, 43, 43, 0.4);
  transform: translateY(0); transition: all 0.2s; pointer-events: auto; user-select: none;
}
.float-btn:hover { transform: translateY(-3px); background: #ff4d4d; }
.float-btn::after {
  content: ''; position: absolute; top: 100%; left: 50%; margin-left: -6px;
  border-width: 6px; border-style: solid;
  border-color: #d22b2b transparent transparent transparent;
}

.modal-mask {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.9); z-index: 2000;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(8px); overflow: hidden; 
}

.modal-content {
  display: flex; flex-direction: column; align-items: center;
  width: 90%; max-width: 400px;
  max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 0;
}

.poster-card {
  width: 320px; 
  background: #1a1a1a; padding: 35px 30px;
  border: 1px solid #333; color: #fff;
  font-family: "Songti SC", "SimSun", serif;
  margin: 0 auto; box-sizing: border-box;
}

.noise-bg {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200