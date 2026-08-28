import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { markerPattern, markerNumber } from './lib.mjs'

const root = process.cwd()
const source = await fs.readFile(path.join(root, '第一卷/004-井冈山的斗争.md'), 'utf8')
const enumerationLine = source.split(/\r?\n/).find((line) => line.includes('中段的长处：'))

if (!enumerationLine) throw new Error('找不到《井冈山的斗争》“中段的长处”段落')

const enumerationMatches = Array.from(enumerationLine.matchAll(markerPattern))
if (enumerationMatches.length !== 0) {
  throw new Error(`正文序号被误识别为脚注：${enumerationMatches.map((match) => match[0]).join('、')}`)
}

const referenceSample = '战争⑴，普通序号（1），第二十一条脚注（21）。'
const referenceMatches = Array.from(referenceSample.matchAll(markerPattern)).map((match) => match[0])
if (referenceMatches.join('|') !== '⑴|（21）') {
  throw new Error(`脚注模式不符合预期：${referenceMatches.join('|')}`)
}
if (markerNumber(referenceMatches[0]) !== 1 || markerNumber(referenceMatches[1]) !== 21) {
  throw new Error('脚注编号解析错误')
}

console.log('角标识别检查通过：（1）—（20）保留为正文序号，⑴—⒇及（21）以上识别为脚注。')
