import assert from 'node:assert/strict'

const storage = new Map()
const listeners = new Map()
const frames = []
let scrollCalls = 0

globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}
globalThis.history = { scrollRestoration: 'auto' }
globalThis.requestAnimationFrame = (callback) => {
  frames.push(callback)
  return frames.length
}
globalThis.document = {
  documentElement: { scrollHeight: 2500, scrollTop: 0 },
  querySelector: (selector) => (selector === '.vp-doc' ? {} : null),
  addEventListener: () => {},
  visibilityState: 'visible',
}
globalThis.window = {
  location: {
    pathname: '/第一卷/017-实践论.html',
    hash: '',
    replace: () => {},
  },
  innerHeight: 600,
  scrollY: 0,
  addEventListener: (name, callback) => listeners.set(name, callback),
  removeEventListener: (name, callback) => {
    if (listeners.get(name) === callback) listeners.delete(name)
  },
  scrollTo: ({ top }) => {
    scrollCalls += 1
    window.scrollY = top
  },
}

const {
  normalizePath,
  isArticlePath,
  toDocumentPath,
  restoreReadingPosition,
  setupReadingPosition,
} = await import('../.vitepress/theme/reading-position.mjs')

assert.equal(
  normalizePath('/第一卷/017-实践论.html?from=home#一'),
  '/第一卷/017-实践论',
)
assert.equal(isArticlePath('/第一卷/017-实践论'), true)
assert.equal(toDocumentPath('/第一卷/017-实践论'), '/第一卷/017-实践论.html')
assert.equal(toDocumentPath('/'), '/')

storage.set(
  'maoxuan-reading-v1',
  JSON.stringify({
    version: 1,
    lastRead: null,
    pages: {
      '/第一卷/017-实践论': { scrollY: 900, ratio: 0.5, updatedAt: 1 },
    },
  }),
)

assert.equal(restoreReadingPosition('/第一卷/017-实践论'), true)
listeners.get('touchstart')()
while (frames.length) frames.shift()()
assert.equal(scrollCalls, 0, '用户开始操作后不应再强制恢复滚动位置')

assert.equal(restoreReadingPosition('/第一卷/017-实践论'), true)
while (frames.length) frames.shift()()
assert.equal(scrollCalls, 1, '滚动位置只应恢复一次')
assert.equal(window.scrollY, 950)

const router = {}
setupReadingPosition(router)
assert.equal(typeof router.onBeforeRouteChange, 'function')
assert.equal(typeof router.onAfterRouteChange, 'function')
assert.equal(typeof router.onAfterPageLoad, 'function')

console.log('reading-position tests: ok')
