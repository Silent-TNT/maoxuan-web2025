const STORAGE_KEY = 'maoxuan-reading-v1'
const SAVE_THROTTLE_MS = 350
const MIN_SCROLL_TO_SAVE = 120
const MAX_STORED_PAGES = 80
const RESTORE_MAX_ATTEMPTS = 10

let saveTimer = null
let skipSaveOnce = false
let restoreGeneration = 0

function normalizePath(path) {
  if (!path) return '/'
  let p = String(path).split('?')[0].split('#')[0]
  if (p.endsWith('.html')) p = p.slice(0, -5)
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1)
  return p || '/'
}

function isArticlePath(path) {
  const p = normalizePath(path)
  if (p === '/' || p === '/donate') return false
  return /^\/[^/]+\/.+/.test(p)
}

function loadStore() {
  if (typeof window === 'undefined') {
    return { version: 1, lastRead: null, pages: {} }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, lastRead: null, pages: {} }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1 || typeof parsed.pages !== 'object') {
      return { version: 1, lastRead: null, pages: {} }
    }
    return {
      version: 1,
      lastRead: parsed.lastRead || null,
      pages: parsed.pages || {},
    }
  } catch {
    return { version: 1, lastRead: null, pages: {} }
  }
}

function persistStore(store) {
  if (typeof window === 'undefined') return
  const entries = Object.entries(store.pages)
  if (entries.length > MAX_STORED_PAGES) {
    entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
    store.pages = Object.fromEntries(entries.slice(0, MAX_STORED_PAGES))
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota exceeded */
  }
}

function getScrollMetrics() {
  const el = document.documentElement
  const scrollY = window.scrollY || el.scrollTop || 0
  const maxScroll = Math.max(0, el.scrollHeight - window.innerHeight)
  const ratio = maxScroll > 0 ? scrollY / maxScroll : 0
  return { scrollY, ratio, maxScroll }
}

function getSavedPosition(store, path) {
  const p = normalizePath(path)
  if (store.pages[p]) return store.pages[p]
  if (store.lastRead && normalizePath(store.lastRead.path) === p) {
    return store.lastRead
  }
  return null
}

function saveReadingPosition(path) {
  if (typeof window === 'undefined') return
  if (skipSaveOnce) {
    skipSaveOnce = false
    return
  }

  const p = normalizePath(path || window.location.pathname)
  const { scrollY, ratio } = getScrollMetrics()
  const store = loadStore()

  if (scrollY < MIN_SCROLL_TO_SAVE) {
    if (store.pages[p]) {
      delete store.pages[p]
      if (store.lastRead && normalizePath(store.lastRead.path) === p) {
        store.lastRead = null
      }
      persistStore(store)
    }
    return
  }

  const entry = { scrollY, ratio, updatedAt: Date.now() }
  store.pages[p] = entry

  if (isArticlePath(p)) {
    store.lastRead = { path: p, ...entry }
  }

  persistStore(store)
}

function scheduleSave(path) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveReadingPosition(path), SAVE_THROTTLE_MS)
}

function computeScrollTarget(saved) {
  const { maxScroll } = getScrollMetrics()
  if (typeof saved.ratio === 'number' && maxScroll > 0) {
    return Math.round(saved.ratio * maxScroll)
  }
  return Math.min(saved.scrollY || 0, maxScroll)
}

function restoreReadingPosition(path) {
  if (typeof window === 'undefined') return false
  if (window.location.hash) return false
  if (!document.querySelector('.vp-doc')) return false

  const p = normalizePath(path || window.location.pathname)
  const store = loadStore()
  const saved = getSavedPosition(store, p)
  if (!saved) return false

  const target = computeScrollTarget(saved)
  if (target < MIN_SCROLL_TO_SAVE) return false

  const generation = ++restoreGeneration
  skipSaveOnce = true

  let attempts = 0
  const apply = () => {
    if (generation !== restoreGeneration) return
    const { maxScroll } = getScrollMetrics()
    const y = Math.min(target, maxScroll)
    window.scrollTo({ top: y, left: 0, behavior: 'instant' })
  }

  const retry = () => {
    if (generation !== restoreGeneration) return
    apply()
    attempts += 1
    const diff = Math.abs(window.scrollY - target)
    if (attempts < RESTORE_MAX_ATTEMPTS && diff > 40) {
      window.setTimeout(retry, 80 + attempts * 50)
    }
  }

  requestAnimationFrame(() => {
    window.setTimeout(retry, 120)
  })

  return true
}

function isColdPageLoad() {
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav?.type === 'navigate' || nav?.type === 'reload'
  } catch {
    return true
  }
}

/** 冷启动在首页时，用整页跳转代替 router.go，避免先闪 404 再加载正文 */
function redirectToLastReadIfNeeded() {
  const current = normalizePath(window.location.pathname)
  if (current !== '/') return false
  if (!isColdPageLoad()) return false

  const store = loadStore()
  const last = store.lastRead
  if (!last?.path || !isArticlePath(last.path)) return false

  const target = normalizePath(last.path)
  if (target === current) return false

  window.location.replace(target)
  return true
}

export function setupReadingPosition(router, hooks = {}) {
  if (typeof window === 'undefined') return

  if (redirectToLastReadIfNeeded()) return

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  window.addEventListener(
    'scroll',
    () => scheduleSave(window.location.pathname),
    { passive: true },
  )

  window.addEventListener('pagehide', () => saveReadingPosition())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveReadingPosition()
    }
  })

  if (typeof router?.onBeforeRouteChange === 'function') {
    router.onBeforeRouteChange(() => {
      saveReadingPosition()
    })
  }

  if (typeof router?.onAfterRouteChanged === 'function') {
    router.onAfterRouteChanged((to) => {
      hooks.onRouteChanged?.(to)
    })
  }

  const prevAfterPageLoad = router?.onAfterPageLoad
  if (router) {
    router.onAfterPageLoad = (href) => {
      prevAfterPageLoad?.(href)
      restoreReadingPosition(href)
    }
  }
}

export { normalizePath, isArticlePath, saveReadingPosition, restoreReadingPosition }
