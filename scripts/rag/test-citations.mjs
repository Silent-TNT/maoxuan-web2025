import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { EventEmitter } from 'node:events'
import { finalizeChatReply, handleChatRequest, handleChatStreamRequest, streamChatResponse } from '../../api/chat-handler.mjs'
import { findQuoteCandidates } from '../../api/rag-evidence.mjs'
import { retrieveContext } from '../../api/rag.mjs'

const questions = JSON.parse(readFileSync(new URL('./eval-questions.json', import.meta.url)))
const { question, expectedQuote, expectedRelated } = questions.find((item) => item.expectedRelated)
const expectedQuotes = [expectedQuote, ...expectedRelated.map((item) => item.expectedQuote)]

function hit(id, title, quotes) {
  return {
    id, title, volume: '第一卷', path: '/第一卷/' + title + '.html',
    quotes: quotes.map(([id, text]) => ({ id, text })),
  }
}

function finalize(rawReply, ragHits) {
  return finalizeChatReply(rawReply, { ragHits, query: question, retrievalStatus: 'retrieved' })
}

function finalizeQuery(rawReply, ragHits, query) {
  return finalizeChatReply(rawReply, { ragHits, query, retrievalStatus: 'retrieved' })
}

const candidates = [
  hit('a-1', '甲文', [['0.0', '甲文第一句。'], ['0.1', '甲文第二句。']]),
  hit('a-2', '甲文', [['0.1', '甲文第二句。'], ['0.2', '甲文第三句。']]),
  hit('b', '乙文', [['0.0', '乙文原句。']]),
  hit('c', '丙文', [['0.0', '丙文原句。']]),
  hit('d', '丁文', [['0.0', '丁文原句。']]),
]

const cited = finalize(
  '第一处。[5.1] 第二处。[1.2][2.1] 仍然支持第一处。[5.1] 第三处。【2.2】[8.1]\n\n' +
    '### 参考原文\n- [1] [《甲文》](/第一卷/甲文.html)[2]',
  candidates,
)
assert.equal(cited.reply, '第一处。[1] 第二处。[2] 仍然支持第一处。[1] 第三处。[3]')
assert.deepEqual(cited.sources.map((source) => [source.sourceNumber, source.title, source.evidenceText]), [
  [1, '丁文', '丁文原句。'], [2, '甲文', '甲文第二句。'], [3, '甲文', '甲文第三句。'],
])
assert.equal(cited.sources[1].path, cited.sources[2].path)

const unknown = finalize('材料不足。[1][1.99][9.1]', candidates)
assert.equal(unknown.reply, '材料不足。')
assert.deepEqual(unknown.sources, [])
assert.deepEqual(finalize('只提到《甲文》。', candidates).sources, [])
assert.equal(finalize('普通编号 [1]。', []).reply, '普通编号 [1]。')
assert.equal(finalize('先查眼下的条件。\n\n原文依据在《甲文》里：“十天之内必须决定。”[1.1]', candidates).reply, '先查眼下的条件。')
assert.equal(finalize('《甲文》写道：“甲文第一句。”[1.1]', candidates).reply, '《甲文》写道：“甲文第一句。”[1]')
assert.equal(finalize('《乙文》写道：“甲文第一句。”[1.1]', candidates).sources.length, 0)
assert.equal(finalize('我没找到《甲文》有“马上辞职”这句。', []).reply, '我没找到《甲文》有“马上辞职”这句。')
assert.doesNotMatch(finalize('原文依据在《甲文》里：“十天之内必须决定。”[1.1]', []).reply, /十天之内/u)

// 守卫只拦“冒充原文”：普通强调引号、否认归属、真引文都必须保留
const guardHits = [hit('g-1', '论持久战', [['0.0', '如果战役和战斗方针也同样是内线的持久的防御战那就决然达不到战略目的。']])]
const termQuotes = '《论持久战》是一九三八年五、六月间在延安讲的。当时国内有两种议论，一是“亡国论”，二是“速胜论”。'
assert.equal(finalizeQuery(termQuotes, guardHits, '《论持久战》是什么时候写的？').reply, termQuotes)
const denialParagraph = '这句话不是《矛盾论》里的原话。《矛盾论》讲的是矛盾的普遍性。“三个月工资”这个说法我确认不了。'
assert.equal(finalizeQuery(denialParagraph, [], '《矛盾论》原话是“辞职前至少攒三个月工资”吗？').reply, denialParagraph)
const impersonated = '《论持久战》里说：“兵民是胜利之本，战争的伟力之最深厚的根源存在于民众之中。”'
const guardedReply = finalizeQuery(impersonated, guardHits, '这句是原文吗？')
assert.doesNotMatch(guardedReply.reply, /兵民是胜利之本/u)
assert.ok(guardedReply.guard?.droppedChars > 0)
assert.match(guardedReply.reply, /说不准|核不着|前后一句/u)
const credited = '《论持久战》里说：“如果战役和战斗方针也同样是内线的持久的防御战那就决然达不到战略目的。”[1.1]'
assert.match(finalizeQuery(credited, guardHits, '原文怎么说？').reply, /如果战役和战斗方针/u)
const actionOnlyAfterDrop = finalizeQuery('（把桌上的书合上）\n\n《矛盾论》里说：“辞职前至少攒三个月工资，这是稳妥的做法。”', [], '这句是原话吗？')
assert.doesNotMatch(actionOnlyAfterDrop.reply, /三个月工资/u)
assert.ok([...actionOnlyAfterDrop.reply].length > 20)
// 「」是复述读者的话，不是引用原文：再长也不能被守卫删掉
const echoParagraph = '你刚才说「我今年三十三岁，在厂里干了八年，现在想换个活法」，这话我记下了。'
assert.equal(finalizeQuery(echoParagraph, [], '我该不该换工作？').reply, echoParagraph)
// 但用「」冒充《篇名》里的原文，照样要核对编号与来源
const bracketFake = '《甲文》里讲，「这不是材料里的句子，是一句编出来的话」[1.1]。'
assert.doesNotMatch(finalizeQuery(bracketFake, candidates, '原文怎么说？').reply, /编出来的话/u)
const bracketCited = '《甲文》里讲，「甲文第一句。」[1.1]'
assert.match(finalizeQuery(bracketCited, candidates, '原文怎么说？').reply, /甲文第一句/u)
const questionAtEnd = finalize('你是哪一杆先出了问题？[1.1]\n<续聊>白球怎么走位？', candidates)
assert.equal(questionAtEnd.reply, '你是哪一杆先出了问题？[1]')
assert.equal(questionAtEnd.awaitingReply, true)
assert.deepEqual(questionAtEnd.suggestions, [])

const index = JSON.parse(gunzipSync(readFileSync(new URL('../../api/rag-index.json.gz', import.meta.url))))
const article = index.chunks.find(({ path }) => path.endsWith('/076-学习和时局.html'))
const cut = { ...article, text: '己聪明能干而看不起老年人' }
const restored = findQuoteCandidates(cut)
assert.ok(restored.some(({ text }) =>
  text === '甚至年龄也可以成为骄傲的工具，青年人可以因为自己聪明能干而看不起老年人，老年人又可以因为自己富有经验而看不起青年人。'))
assert.ok(restored.every(({ text }) => !text.startsWith('己聪明')))
assert.deepEqual(findQuoteCandidates({ ...cut, text: '这句不存在于原文。' }), [])
const denseFixture = index.chunks.find((chunk) => chunk.path === article.path && chunk.embedding && findQuoteCandidates(chunk).length)

const { context } = await retrieveContext(question, { keywordOnly: true })
const quoteLines = expectedQuotes.map((quote) => context.split('\n').find((line) => line.endsWith(quote)))
assert.ok(quoteLines.every(Boolean))
const [marker, relatedMarker, verificationMarker] = quoteLines.map((line) => line.split(' ')[0])
const newQuestion = '我去年帮一家小店做促销成功了，换一家客群完全不同的店也应该照搬这套办法吧？《毛选》有没有能反驳我的说法？'
const practiceQuestion = '我打台球连输八场，有点焦虑。下一场该怎么练，才能知道自己真的进步了？'
const clarifyBilliards = '八场里头，你是一直追不上，还是有几场到了最后一两颗球才输？'
const lateLoss = '我常输在最后一颗球。'
const earlyLoss = '我总是追不上。'
const fallbackQuestion = '我没弄清楚自己总输在哪里，该怎么办？'
const listeningMessage = '我今天累了，不想听建议，只想有人听我说说。'
const madeUpQuoteQuestion = '《矛盾论》原话是“辞职前至少攒三个月工资”吗？这句话出自哪里？'
const answerWithoutEvidence = '先把眼下最难熬的那一件事说清。'
const investigationQuote = '你对那个问题的现实情况和历史情况既然没有调查，不知底里，对于那个问题的发言便一定是瞎说一顿。'
const practiceQuote = '要完全地解决这个问题，只有把理性的认识再回到社会实践中去，应用理论于实践，看它是否能够达到预想的目的。'
let modelCalls = 0
let embeddingCalls = 0
let planningCalls = 0
let rerankCalls = 0
let slowPlannerSignal
process.env.DEEPSEEK_API_KEY = 'test-chat'
process.env.EMBEDDING_API_KEY = 'test-embedding'
// 引文重排的收益只能用真实重排服务衡量；单测里默认关掉，改用下面专门的用例验证通路
process.env.RAG_QUOTE_RERANK = '0'
delete process.env.RAG_DISABLED
const realFetch = globalThis.fetch
const mockReply = '文章把有成绩和没成绩时的心态并列讨论。' + marker +
  ' 外界影响通过自身条件起作用。' + relatedMarker +
  ' 还要核对实际情况。' + verificationMarker
const followUp = '遇到同样的输赢，怎么查条件变了没有？'
const mockReplyWithFooter = mockReply + '\n<续聊>' + followUp
const continuationSearches = []
globalThis.fetch = async (url, options) => {
  if (url.endsWith('/rerank')) {
    // 确定性重排：提到「预想的目的」的文档排最前，其余保持原顺序
    rerankCalls++
    const payload = JSON.parse(options.body)
    return Response.json({
      results: (payload.documents || []).map((document, index) => ({
        index,
        relevance_score: /预想的目的/.test(document) ? 100 - index : -index,
      })),
    })
  }
  if (url.endsWith('/embeddings')) {
    embeddingCalls++
    const input = JSON.parse(options.body).input[0]
    if (input.includes(lateLoss) || input.includes(earlyLoss)) continuationSearches.push(input)
    if (input === 'zzzxq876 pppqi999') {
      return Response.json({ data: [{ index: 0, embedding: index.chunks[0].embedding.map((value) => -value) }] })
    }
    if (input.endsWith('zzzxq877 strongvector')) {
      return Response.json({ data: [{ index: 0, embedding: denseFixture.embedding }] })
    }
    return new Response(JSON.stringify({ error: { message: 'mock embedding outage' } }), { status: 503 })
  }
  assert.ok(url.endsWith('/chat/completions'))
  const payload = JSON.parse(options.body)
  if (payload.response_format?.type === 'json_object') {
    planningCalls++
    if (payload.messages.at(-1).content.includes(fallbackQuestion)) {
      slowPlannerSignal = options.signal
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
    }
    if (payload.messages.at(-1).content.includes(practiceQuestion)) {
      assert.match(payload.messages[0].content, /methods 数组/u)
      if (payload.messages.at(-1).content.includes(lateLoss) || payload.messages.at(-1).content.includes(earlyLoss)) {
        assert.match(payload.messages[0].content, /把新增事实放回原问题/u)
      }
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        methods: ['调查研究', '实践检验'],
        challenge: '条件可比 客观实际',
      }) } }] })
    }
    if (!payload.messages.at(-1).content.includes(newQuestion)) {
      return Response.json({ error: 'mock planning outage' }, { status: 503 })
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      challenge: '《反对本本主义》调查 实际情况 现实情况 历史情况',
      verification: '理性的认识 回到社会实践 预想的目的',
    }) } }] })
  }

  modelCalls++
  const prompt = payload.messages[0].content
  assert.match(prompt, /【当面接话的样稿】/u)
  const userQuery = payload.messages.at(-1).content
  if (userQuery === madeUpQuoteQuestion) {
    assert.doesNotMatch(prompt, /【本次从《毛泽东选集》检索到的原著摘录】/u)
    return new Response([
      '先说你问的这个出处。\n\n',
      '《矛盾论》写道：“辞职前至少攒三个月工资”。[1.7]\n\n',
      '我手头没找到能证实的原话。',
    ].map((content) => 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n').join('') + 'data: [DONE]\n\n')
  }
  if (userQuery === '那照前头那些情况，什么时候再看？') {
    assert.match(prompt, /【读者早先说过的话，按先后排列】/u)
    assert.match(prompt, /手头的钱够三个月/u)
    assert.doesNotMatch(prompt, /替读者捏造的说法/u)
    assert.match(prompt, /以最近一次说法为准/u)
    assert.equal(payload.messages.length, 11)
    return Response.json({ choices: [{ message: { content: '到项目收尾时再看。' } }] })
  }
  if (userQuery === listeningMessage) {
    assert.doesNotMatch(prompt, /【后台分析方向】|【本次从《毛泽东选集》检索到的原著摘录/u)
    return Response.json({ choices: [{ message: { content: '你慢慢说，我听着。' } }] })
  }
  if (userQuery === lateLoss || userQuery === earlyLoss) {
    assert.deepEqual(payload.messages.slice(-3).map(({ content }) => content), [practiceQuestion, clarifyBilliards, userQuery])
    assert.match(prompt, /【后台分析方向】\n调查研究.+实践检验/u)
    assert.match(prompt, /课题|预想的目的/u)
    const reply = userQuery === lateLoss ? '那就查最后一杆的白球位。' : '那就记三轮，看最早在哪一步把球权交出去了。'
    return Response.json({ choices: [{ message: { content: reply } }] })
  }
  if ([newQuestion, practiceQuestion, fallbackQuestion].includes(userQuery)) {
    if (userQuery === fallbackQuestion) {
      assert.ok(slowPlannerSignal.aborted)
      assert.doesNotMatch(prompt, /【后台分析方向】/u)
      return Response.json({ choices: [{ message: { content: answerWithoutEvidence } }] })
    }
    const expected = [investigationQuote, practiceQuote]
    const lines = expected
      .map((quote) => prompt.split('\n').find((line) => line.endsWith(quote)))
    assert.ok(lines.every(Boolean))
    if (userQuery === practiceQuestion) {
      assert.match(prompt, /【后台分析方向】\n调查研究.+实践检验/u)
      assert.ok(prompt.lastIndexOf('【当面接话的样稿】') > prompt.lastIndexOf('【引用格式（严格执行）】'))
      return Response.json({ choices: [{ message: { content: clarifyBilliards } }] })
    }
    const references = lines.map((line) => line.split(' ')[0]).join('')
    return Response.json({ choices: [{ message: { content: '先调查新店的条件，再检验办法。' + references } }] })
  }
  assert.ok(quoteLines.every((line) => prompt.includes(line)))
  if (payload.stream) {
    const deltas = [mockReply.slice(0, -10), mockReply.slice(-10) + '\n<续', '聊>' + followUp]
    return new Response(deltas.map((content) =>
      'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n',
    ).join('') + 'data: [DONE]\n\n')
  }
  return Response.json({ choices: [{ message: { content: mockReplyWithFooter } }] })
}

try {
  const body = { messages: [{ role: 'user', content: question }] }
  const jsonResult = await handleChatRequest(body)
  let streamText = ''
  const streamResult = await handleChatStreamRequest(body, (delta) => { streamText += delta })
  assert.equal(streamText.trimEnd(), mockReply.replace(/\[\d+\.\d+\]/gu, ''))
  assert.equal(embeddingCalls, 2)
  assert.equal(planningCalls, 2)
  assert.equal(modelCalls, 2)
  assert.deepEqual(streamResult, jsonResult)
  assert.deepEqual(jsonResult.suggestions, [followUp])
  assert.equal(jsonResult.reply, '文章把有成绩和没成绩时的心态并列讨论。[1] 外界影响通过自身条件起作用。[2] 还要核对实际情况。[3]')
  assert.deepEqual(jsonResult.sources.map((source) => source.evidenceText), expectedQuotes)
  assert.ok(jsonResult.sources[0].contextText.includes(expectedQuote))
  const generalized = await handleChatRequest({ messages: [{ role: 'user', content: newQuestion }] })
  assert.deepEqual(generalized.sources.map((source) => source.evidenceText), [investigationQuote, practiceQuote])
  assert.equal(planningCalls, 3)
  const practical = await handleChatRequest({ messages: [{ role: 'user', content: practiceQuestion }] })
  assert.equal(practical.reply, clarifyBilliards)
  assert.equal(practical.awaitingReply, true)
  assert.deepEqual(practical.suggestions, [])
  assert.equal(planningCalls, 4)
  const fallback = await handleChatRequest({ messages: [{ role: 'user', content: fallbackQuestion }] })
  assert.equal(fallback.reply, answerWithoutEvidence)
  assert.deepEqual(fallback.sources, [])
  assert.equal(planningCalls, 5)

  // 引文级重排通路：mock 把含「预想的目的」的句子排最前，验证确实按重排分数挑句
  process.env.RAG_QUOTE_RERANK = '1'
  const rerankedQuotes = await retrieveContext(practiceQuestion, {
    plannedQueries: ['《实践论》把理性的认识再回到社会实践中去 应用理论于实践 预想的目的'],
  })
  const rerankedTexts = rerankedQuotes.hits.flatMap((hit) => hit.quotes.map((quote) => quote.text))
  assert.ok(rerankedTexts.includes(practiceQuote))
  assert.equal(rerankedQuotes.rerank, true)
  process.env.RAG_QUOTE_RERANK = '0'
  const beforeListening = embeddingCalls
  await handleChatRequest({ messages: [{ role: 'user', content: listeningMessage }] })
  assert.equal(planningCalls, 5)
  assert.equal(embeddingCalls, beforeListening)
  const dialogue = [{ role: 'user', content: practiceQuestion }, { role: 'assistant', content: practical.reply }]
  const late = await handleChatRequest({ messages: [...dialogue, { role: 'user', content: lateLoss }] })
  const early = await handleChatRequest({ messages: [...dialogue, { role: 'user', content: earlyLoss }] })
  assert.deepEqual(continuationSearches, [lateLoss + '\n' + practiceQuestion, earlyLoss + '\n' + practiceQuestion])
  assert.match(late.reply, /最后一杆的白球位/u)
  assert.match(early.reply, /把球权交出去/u)
  assert.equal(planningCalls, 7)

  let guardedStream = ''
  const falseQuote = await handleChatStreamRequest(
    { messages: [{ role: 'user', content: madeUpQuoteQuestion }] },
    (delta) => { guardedStream += delta },
  )
  assert.doesNotMatch(guardedStream, /攒三个月工资/u)
  assert.doesNotMatch(falseQuote.reply, /攒三个月工资/u)
  assert.equal(falseQuote.sources.length, 0)
  assert.equal(falseQuote.retrievalMode, 'exact-quote')

  const earlier = [
    { role: 'user', content: '手头的钱够三个月。' },
    { role: 'assistant', content: '替读者捏造的说法。' },
    ...Array.from({ length: 6 }, (_, turn) => [
      { role: 'user', content: `这是第 ${turn + 1} 次补充。` },
      { role: 'assistant', content: '我听清了。' },
    ]).flat(),
    { role: 'user', content: '那照前头那些情况，什么时候再看？' },
  ]
  await handleChatRequest({ messages: earlier })

  const weakVectors = await retrieveContext('zzzxq876 pppqi999')
  // 向量全负分时如实报 dense-empty，不再假装 hybrid
  assert.equal(weakVectors.mode, 'dense-empty')
  assert.deepEqual(weakVectors.hits, [])
  const strongVector = await retrieveContext('zzzxq877 strongvector')
  assert.equal(strongVector.mode, 'hybrid')
  assert.equal(strongVector.hits[0]?.path, denseFixture.path)

  const req = new EventEmitter()
  const res = new EventEmitter()
  res.setHeader = () => {}
  res.end = () => assert.fail('closed stream should not write')
  let signalSeen
  globalThis.fetch = (_url, { signal }) => {
    signalSeen = signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  }
  const closing = streamChatResponse(req, res, { messages: [{ role: 'user', content: listeningMessage }] })
  await new Promise((resolve) => setImmediate(resolve))
  res.destroyed = true
  res.emit('close')
  await closing
  assert.ok(signalSeen.aborted)
} finally {
  globalThis.fetch = realFetch
}

console.log('PASS: citations, streamed reply footer, practical methods, and clarified conversation branches')
