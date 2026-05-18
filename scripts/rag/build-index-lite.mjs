/**
 * 无 Embedding API 时的轻量索引（关键词检索，便于先跑通链路）
 * 正式体验向量检索请用: npm run rag:build
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { buildChunksFromRepo } from './lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outGz = path.join(root, 'api/rag-index.json.gz')

const chunks = buildChunksFromRepo(root)
const index = {
  version: 1,
  mode: 'keyword',
  builtAt: new Date().toISOString(),
  chunks: chunks.map((c) => ({
    id: c.id,
    volume: c.volume,
    title: c.title,
    path: c.path,
    text: c.text,
  })),
}

const json = JSON.stringify(index)
const gz = zlib.gzipSync(Buffer.from(json, 'utf8'))
fs.writeFileSync(outGz, gz)
console.log(`keyword 索引: ${chunks.length} 块 → ${outGz} (${(gz.length / 1024).toFixed(0)} KB)`)
