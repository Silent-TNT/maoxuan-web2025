import path from 'path'
import { fileURLToPath } from 'url'
import { buildChunksFromRepo } from './lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const chunks = buildChunksFromRepo(root)
console.log('文章块数:', chunks.length)
