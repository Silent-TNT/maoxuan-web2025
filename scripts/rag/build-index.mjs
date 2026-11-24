/**
 * 方案 A：切块 + Embedding → api/rag-index.json.gz
 * 运行: npm run rag:build
 * 需配置 EMBEDDING_API_KEY 或 SILICONFLOW_API_KEY（硅基流动 OpenAI 兼容接口）
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
loadEnv({ path: path.join(root, '.env') })
import {
  buildChunksFromRepo,
  CHUNK_VERSION,
  embedInBatches,
  getEmbeddingConfig,
} from './lib.mjs'

const outGz = path.join(root, 'api/rag-index.json.gz')
const outJson = path.join(root, 'api/rag-index.json')

async function main() {
  console.log('扫描四卷文章并切块…')
  const chunks = buildChunksFromRepo(root)
  console.log(`共 ${chunks.length} 个文本块`)

  const config = getEmbeddingConfig()
  console.log(`Embedding 模型: ${config.model}`)
  console.log(`API: ${config.baseUrl}`)

  // bge 输入上限 512 token：超长块只取前 480 字符做向量，正文仍按全文入库
  const EMBED_MAX_CHARS = 480
  const texts = chunks.map((c) => `${c.title}\n${c.text}`.slice(0, EMBED_MAX_CHARS))
  const vectors = await embedInBatches(texts, config, 10)
  const dim = vectors[0]?.length ?? 0

  // 向量保留 6 位小数：余弦精度足够，索引体积从 ~26MB 压回 ~16MB
  const roundVector = (vector) => vector.map((value) => Math.round(value * 1e6) / 1e6)
  const index = {
    version: CHUNK_VERSION,
    mode: 'vector',
    builtAt: new Date().toISOString(),
    model: config.model,
    dim,
    chunks: chunks.map((c, i) => ({
      id: c.id,
      volume: c.volume,
      title: c.title,
      path: c.path,
      text: c.text,
      embedding: roundVector(vectors[i]),
    })),
  }

  const json = JSON.stringify(index)
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'))
  const temporaryIndex = `${outGz}.${process.pid}.tmp`
  try {
    fs.writeFileSync(temporaryIndex, gz, { flag: 'wx' })
    fs.renameSync(temporaryIndex, outGz)
  } finally {
    fs.rmSync(temporaryIndex, { force: true })
  }
  console.log(`已写入 ${outGz} (${(gz.length / 1024 / 1024).toFixed(2)} MB 压缩)`)

  if (process.env.RAG_WRITE_JSON === '1') {
    fs.writeFileSync(outJson, json)
    console.log(`已写入 ${outJson} (${(json.length / 1024 / 1024).toFixed(2)} MB 明文，仅调试用)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
