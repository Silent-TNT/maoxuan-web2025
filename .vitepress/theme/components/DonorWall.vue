<script setup>
import { ref } from 'vue'
// 导入名单数据
import donors from '../../donors.json'

// 计算距离 2049 年 10 月 1 日还有多少天
const targetDate = new Date('2049-10-01')
const today = new Date()
const diffTime = Math.abs(targetDate - today)
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
</script>

<template>
  <div class="star-sky">
    <div class="countdown">
      🔥 距离 2049 年建国百年还有 <span class="days">{{ diffDays }}</span> 天
    </div>

    <div class="wall-container">
      <div 
        class="spark" 
        v-for="(donor, index) in donors" 
        :key="index"
        :title="donor.message" 
      >
        <span class="icon">✨</span>
        <span class="name">{{ donor.name }}</span>
        <div class="tooltip">{{ donor.message }}</div>
      </div>
      
      <div class="waiting">
        ... 等待更多火种汇入
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 深邃夜空背景 */
.star-sky {
  margin-top: 20px;
  padding: 30px;
  border-radius: 12px;
  /* 经典的深蓝黑渐变，模拟夜空 */
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
  color: #fff;
  border: 1px solid #333;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.countdown {
  text-align: center;
  font-size: 14px;
  color: #8892b0;
  margin-bottom: 25px;
  font-family: monospace;
}
.days {
  color: #ff4d4d; /* 红色高亮天数 */
  font-weight: bold;
  font-size: 16px;
}

.wall-container {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
}

.spark {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

/* 你的名字（第一颗星）特殊高亮 */
.spark:first-child {
  border-color: #d22b2b;
  background: rgba(210, 43, 43, 0.1);
  box-shadow: 0 0 10px rgba(210, 43, 43, 0.3);
}

.spark:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.15);
  border-color: #fff;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.5); /* 发光效果 */
}

.icon {
  margin-right: 6px;
  animation: twinkle 3s infinite ease-in-out;
}

.waiting {
  font-size: 12px;
  color: #555;
  margin-top: 10px;
  width: 100%;
  text-align: center;
}

/* 寄语悬浮框 (Tooltip) */
.tooltip {
  visibility: hidden;
  width: 120px;
  background-color: #d22b2b; /* 红色背景 */
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px;
  position: absolute;
  z-index: 1;
  bottom: 125%; /* 显示在上方 */
  left: 50%;
  margin-left: -60px;
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: #d22b2b transparent transparent transparent;
}

.spark:hover .tooltip {
  visibility: visible;
  opacity: 1;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>