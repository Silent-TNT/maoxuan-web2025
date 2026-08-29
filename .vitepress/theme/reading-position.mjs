const STORAGE_KEY = 'maoxuan-reading-v1'
const SAVE_THROTTLE_MS = 350
const MIN_SCROLL_TO_SAVE = 120
const MAX_STORED_PAGES = 80
const RESTORE_STABLE_FRAMES = 2
const RESTORE_MAX_FRAMES = 12

let saveTimer = null
let suppressSaveUntil = 0
let restoreGeneration = 0

const RESTORE_CANCEL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown']

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
  if (Date.now() < suppressSaveUntil) return

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

function cancelScheduledSave() {
  clearTimeout(saveTimer)
  saveTimer = null
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

  const generation = ++restoreGeneration
  let frameCount = 0
  let stableFrames = 0
  let previousHeight = -1

  const cleanup = () => {
    RESTORE_CANCEL_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, cancel, true)
    })
  }

  const cancel = () => {
    if (generation === restoreGeneration) restoreGeneration += 1
    cleanup()
  }

  const applyOnce = () => {
    if (generation !== restoreGeneration) return cleanup()
    if (normalizePath(window.location.pathname) !== p) return cancel()

    const target = computeScrollTarget(saved)
    cleanup()
    if (target < MIN_SCROLL_TO_SAVE) return

    suppressSaveUntil = Date.now() + SAVE_THROTTLE_MS + 50
    window.scrollTo({ top: target, left: 0, behavior: 'instant' })
  }

  const waitForStableLayout = () => {
    if (generation !== restoreGeneration) return cleanup()

    const height = document.documentElement.scrollHeight
    stableFrames = height === previousHeight ? stableFrames + 1 : 0
    previousHeight = height
    frameCount += 1

    if (stableFrames >= RESTORE_STABLE_FRAMES || frameCount >= RESTORE_MAX_FRAMES) {
      applyOnce()
      return
    }

    requestAnimationFrame(waitForStableLayout)
  }

  RESTORE_CANCEL_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, cancel, { capture: true, passive: true })
  })
  requestAnimationFrame(waitForStableLayout)

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

function toDocumentPath(path) {
  const target = normalizePath(path)
  return isArticlePath(target) ? `${target}.html` : target
}

/** 冷启动在首页时，直接打开构建产物中的文章页，避免落入 404 外壳。 */
function redirectToLastReadIfNeeded() {
  const current = normalizePath(window.location.pathname)
  if (current !== '/') return false
  if (!isColdPageLoad()) return false

  const store = loadStore()
  const last = store.lastRead
  if (!last?.path || !isArticlePath(last.path)) return false

  const target = normalizePath(last.path)
  if (target === current) return false

  window.location.replace(toDocumentPath(target))
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

  if (router) {
    const prevBeforeRouteChange = router.onBeforeRouteChange
    router.onBeforeRouteChange = async (to) => {
      const result = await prevBeforeRouteChange?.(to)
      if (result === false) return false
      restoreGeneration += 1
      cancelScheduledSave()
      saveReadingPosition()
    }
  }

  if (router) {
    const prevAfterRouteChange = router.onAfterRouteChange ?? router.onAfterRouteChanged
    router.onAfterRouteChange = async (to) => {
      await prevAfterRouteChange?.(to)
      hooks.onRouteChanged?.(to)
    }
  }

  const prevAfterPageLoad = router?.onAfterPageLoad
  if (router) {
    router.onAfterPageLoad = async (href) => {
      await prevAfterPageLoad?.(href)
      restoreReadingPosition(href)
    }
  }
}

export {
  normalizePath,
  isArticlePath,
  toDocumentPath,
  saveReadingPosition,
  restoreReadingPosition,
}
