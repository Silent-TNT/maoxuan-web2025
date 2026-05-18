/**
 * 构建索引前校验 Embedding API 是否可用
 * 运行: npm run rag:check
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { embedTexts, getEmbeddingConfig } from './lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
loadEnv({ path: path.join(root, '.env') })

const config = getEmbeddingConfig()

function maskKey(key) {
  if (!key) return '(未设置)'
  if (key.length < 12) return '(过短，可能无效)'
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

async function main() {
  console.log('Embedding 配置检查')
  console.log('  API:', config.baseUrl)
  console.log('  模型:', config.model)
  console.log('  Key:', maskKey(config.apiKey))

  if (!config.apiKey || /xxx|your_|replace|示例/i.test(config.apiKey)) {
    console.error('\n❌ EMBEDDING_API_KEY 仍是占位符或未填写。')
    console.error('   请到 https://cloud.siliconflow.cn 创建 API Key，写入项目根目录 .env：')
    console.error('   EMBEDDING_API_KEY=sk-你的真实密钥')
    process.exit(1)
  }

  try {
    const [vec] = await embedTexts(['语义检索连通性测试'], config)
    console.log(`\n✅ API 可用，向量维度 ${vec.length}`)
    console.log('   可执行: npm run rag:build')
  } catch (err) {
    console.error(`\n❌ 调用失败: ${err.message}`)
    if (/invalid/i.test(String(err.message))) {
      console.error('\n常见原因：')
      console.error('  1. Key 复制不完整，或多了空格、引号')
      console.error('  2. Key 在硅基流动已删除/禁用，需重新创建')
      console.error('  3. 账户未实名/无余额（新用户一般送免费额度）')
      console.error('  4. .env 改完后需在同一终端重新运行命令')
    }
    process.exit(1)
  }
}

main()
