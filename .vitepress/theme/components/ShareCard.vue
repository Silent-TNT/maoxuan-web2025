<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// 动态变量
let html2canvas = null
const visible = ref(false)
const showModal = ref(false)
const buttonStyle = ref({ top: '0px', left: '0px' })
const quote = ref('')
const generating = ref(false)
const cardImage = ref(null)

// 1. 监听选词
const handleSelection = () => {
  const selection = window.getSelection()
  const text = selection.toString().trim()

  // 限制：只有选中 5~300 个字时才显示按钮
  if (text.length > 5 && text.length < 300) { 
    quote.value = text
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    // 计算按钮位置：显示在选中文本的上方中间
    buttonStyle.value = {
      top: `${window.scrollY + rect.top - 45}px`,
      left: `${rect.left + (rect.width / 2) - 50}px`
    }
    visible.value = true
  } else {
    visible.value = false
  }
}

// 2. 生成图片核心逻辑
const generateCard = async () => {
  // 动态导入 html2canvas，防止构建时报错
  if (!html2canvas) {
    html2canvas = (await import('html2canvas')).default
  }
  
  visible.value = false
  showModal.value = true
  generating.value = true
  cardImage.value = null

  await nextTick() // 等待 DOM 渲染
  
  const element = document.getElementById('poster-node')
  if (element) {
    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: '#1a1a1a', // 强制背景色
        scale: 2 // 2倍清晰度
      })
      cardImage.value = canvas.toDataURL('image/png')
    } catch (e) {
      console.error('生成失败', e)
    } finally {
      generating.value = false
    }
  }
}

const closeModal = () => {
  showModal.value = false
  window.getSelection().removeAllRanges() // 取消选区
}

onMounted(() => {
  // 电脑端监听鼠标松开
  document.addEventListener('mouseup', handleSelection)
  // 手机端监听触摸结束
  document.addEventListener('touchend', () => setTimeout(handleSelection, 100))
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
        
        <div id="poster-node" class="poster-card">
          <div class="poster-header">“</div>
          <div class="poster-body">{{ quote }}</div>
          <div class="poster-footer">
            <div class="footer-info">
              <div class="author">毛泽东选集</div>
              <div class="site">xuemaoxuan.com</div>
            </div>
            <img src="/mobile-qr.png" class="qr-code" crossOrigin="anonymous">
          </div>
          <div class="noise-bg"></div>
        </div>

        <div class="result-area">
          <h3 class="tip-text">长按保存图片分享</h3>
          <div v-if="generating" class="loading">正在绘制海报...</div>
          <img v-if="cardImage" :src="cardImage" class="final-img" alt="分享卡片">
          <button class="close-btn" @click="closeModal">关闭</button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* 悬浮按钮 */
.float-btn {
  position: absolute; z-index: 1000;
  background: #d22b2b; color: #fff; padding: 8px 16px;
  border-radius: 50px; font-size: 13px; font-weight: bold;
  cursor: pointer; box-shadow: 0 4px 15px rgba(210, 43, 43, 0.4);
  transform: translateY(0); transition: all 0.2s;
  pointer-events: auto;
}
.float-btn:hover { transform: translateY(-3px); background: #ff4d4d; }
/* 小三角箭头 */
.float-btn::after {
  content: ''; position: absolute; top: 100%; left: 50%; margin-left: -6px;
  border-width: 6px; border-style: solid;
  border-color: #d22b2b transparent transparent transparent;
}

/* 弹窗遮罩 */
.modal-mask {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.9); z-index: 2000;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(8px);
}
.modal-content { display: flex; flex-direction: column; align-items: center; max-width: 90%; }

/* --- 海报设计 (黑金风格) --- */
.poster-card {
  /* 这个元素平时会被生成的图片挡住，但必须存在且可见才能截图 */
  width: 320px; background: #1a1a1a; padding: 35px 30px;
  border: 1px solid #333; color: #fff;
  font-family: "Songti SC", "SimSun", serif; /* 宋体更有书卷气 */
  position: fixed; left: -9999px; top: 0; /* 移出屏幕外进行渲染，防止闪烁 */
}
/* 生成图片时临时移回来 */
#poster-node { 
  position: static; margin-bottom: 20px; 
  /* 如果生成好了，就隐藏原始DOM，只显示图片 */
  display: block;
}
.result-area img + #poster-node { display: none; }

.noise-bg {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none; opacity: 0.4; z-index: 0;
}

.poster-header { font-size: 80px; color: #d22b2b; line-height: 0.5; font-family: serif; opacity: 0.9; margin-bottom: 20px;}
.poster-body {
  font-size: 19px; line-height: 1.8; text-align: justify;
  margin-bottom: 40px; font-weight: 300; z-index: 1; position: relative;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.poster-footer {
  display: flex; justify-content: space-between; align-items: flex-end;
  border-top: 1px solid rgba(255,255,255,0.15); padding-top: 20px;
  z-index: 1; position: relative;
}
.author { font-size: 16px; font-weight: bold; color: #eee; margin-bottom: 4px; letter-spacing: 1px; }
.site { font-size: 12px; color: #666; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px; }
.qr-code { width: 55px; height: 55px; border-radius: 4px; border: 2px solid #fff; }

.result-area { display: flex; flex-direction: column; align-items: center; }
.tip-text { color: #fff; margin-top: 0; font-weight: normal; letter-spacing: 1px; opacity: 0.8; }
.final-img { width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); border-radius: 8px; margin-bottom: 20px; border: 1px solid #333; }
.close-btn {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;
  padding: 8px 30px; border-radius: 50px; cursor: pointer; margin-top: 5px; transition: 0.2s;
}
.close-btn:hover { background: #fff; color: #000; }
.loading { color: #888; margin: 20px; }
</style>