import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, '.vitepress', 'config.mts')

const config = await readFile(configPath, 'utf8')
const configuredLinks = [...config.matchAll(/link:\s*'([^']+)'/g)].map((match) => match[1])

const entries = await readdir(root, { withFileTypes: true })
const markdownPaths = new Set(['/'])

for (const entry of entries) {
  if (!entry.isDirectory()) continue
  if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'api' || entry.name === 'scripts') {
    continue
  }

  const dir = path.join(root, entry.name)
  const files = await readdir(dir)
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    markdownPaths.add(`/${entry.name}/${file.replace(/\.md$/, '')}`)
    markdownPaths.add(`/${entry.name}/${file.replace(/\.md$/, '')}.html`)
  }
}

for (const file of entries) {
  if (file.isFile() && file.name.endsWith('.md')) {
    const route = file.name === 'index.md' ? '/' : `/${file.name.replace(/\.md$/, '')}`
    markdownPaths.add(route)
    markdownPaths.add(`${route}.html`)
  }
}

const broken = configuredLinks.filter((link) => {
  if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#')) return false
  return !markdownPaths.has(link)
})

if (broken.length > 0) {
  console.error('Broken VitePress links:')
  for (const link of broken) console.error(`- ${link}`)
  process.exit(1)
}

console.log(`Checked ${configuredLinks.length} VitePress links. No broken local links found.`)
