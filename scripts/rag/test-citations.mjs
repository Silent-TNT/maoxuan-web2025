import assert from 'node:assert/strict'
import { finalizeChatReply } from '../../api/chat-handler.mjs'

function context(ragHits) {
  return {
    ragHits,
    query: '这两处原文分别说明什么？',
    readingContext: null,
    retrievalStatus: 'retrieved',
  }
}

const sameArticleHits = [
  { id: 'a-1', title: '甲文', volume: '第一卷', path: '/第一卷/甲文.html', text: '第一处原文。' },
  { id: 'a-2', title: '甲文', volume: '第一卷', path: '/第一卷/甲文.html', text: '第二处原文。' },
]

const sameArticle = finalizeChatReply(
  '第一处说明甲。[1] 第二处说明乙。[2]\n\n参考原文：[《甲文》](/第一卷/甲文.html)[1]、[《甲文》](/第一卷/甲文.html)[1]',
  context(sameArticleHits),
)
assert.deepEqual(sameArticle.sources.map((source) => source.sourceNumber), [1, 2])
assert.deepEqual(sameArticle.sources.map((source) => source.evidenceText), ['第一处原文。', '第二处原文。'])
assert.match(sameArticle.reply, /\/第一卷\/甲文\.html\)\[2\]/)

const distinctArticleHits = [
  { id: 'a', title: '甲文', volume: '第一卷', path: '/第一卷/甲文.html', text: '甲文原文。' },
  { id: 'b', title: '乙文', volume: '第二卷', path: '/第二卷/乙文.html', text: '乙文原文。' },
]
const distinctArticles = finalizeChatReply(
  '[《甲文》](/第一卷/甲文.html)[1] 与 [《乙文》](/第二卷/乙文.html)[1] 可以相互参照。',
  context(distinctArticleHits),
)
assert.deepEqual(distinctArticles.sources.map((source) => source.sourceNumber), [1, 2])
assert.match(distinctArticles.reply, /\/第二卷\/乙文\.html\)\[2\]/)

const markersWithoutLinks = finalizeChatReply(
  '第一点见[1]，第二点见[2]。',
  context(distinctArticleHits),
)
assert.deepEqual(markersWithoutLinks.sources.map((source) => source.sourceNumber), [1, 2])
assert.match(markersWithoutLinks.reply, /参考原文：.*甲文.*乙文/)

console.log('citation tests passed: 3/3')
