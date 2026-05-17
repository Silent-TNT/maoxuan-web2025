import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), '../.vitepress/theme/components/AiChat.vue')
let s = fs.readFileSync(p, 'utf8')

// Re-apply Chinese UI strings if corrupted
const replacements = [
  [/class="msg-bubble thinking">[^<]+</, 'class="msg-bubble thinking">教员思考中…<'],
  [/placeholder="[^"]*"/, 'placeholder="问问教员..."'],
  [/>(清空对话|æ¸[^<]*)</, '>清空对话<'],
  [/>(收起|æ"[^<]*)</, '>收起<'],
  [/>(★ 咨询教员|â˜[^<]*)</, '>★ 咨询教员<'],
]

for (const [re, rep] of replacements) {
  s = s.replace(re, rep)
}

// Rewrite known string blocks from good template
s = s.replace(
  /const sampleQuestions = \[[\s\S]*?\]/,
  `const sampleQuestions = [
  '请问教员如何看待当今之中国？',
  '最近感觉非常迷茫和内耗，该怎么办？',
  '如何看待现在的“毛选热”？',
  '《矛盾论》的精髓到底是什么？',
]`,
)

s = s.replace(
  /if \(typeof window !== 'undefined' && !window\.confirm\('[^']*'\)\)/,
  "if (typeof window !== 'undefined' && !window.confirm('确定清空当前对话吗？'))",
)

s = s.replace("throw new Error('网络异常')", "throw new Error('网络异常')")
s = s.replace(
  /content: data\.reply \|\| '[^']*'/,
  "content: data.reply || '（教员正在沉思）'",
)
s = s.replace(
  /content: '网络似乎出了点问题[^']*'/,
  "content: '网络似乎出了点问题，我们稍后再谈。'",
)

fs.writeFileSync(p, s, 'utf8')
console.log('AiChat.vue encoding fixed')
