/**
 * 百度统计事件封装
 * @see https://tongji.baidu.com/api/manual?chapter=Event
 */

function getHmt() {
  if (typeof window === 'undefined') return null
  window._hmt = window._hmt || []
  return window._hmt
}

/** SPA 路由切换后上报页面浏览 */
export function trackPageview(path) {
  const hmt = getHmt()
  if (!hmt) return
  const p =
    path ||
    (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')
  hmt.push(['_trackPageview', p])
}

/**
 * @param {string} category 类别，如 chat / donate / share
 * @param {string} action 操作，如 open / send
 * @param {string} [label] 可选标签
 * @param {number} [value] 可选数值
 */
export function trackEvent(category, action, label = '', value = 0) {
  const hmt = getHmt()
  if (!hmt) return
  hmt.push(['_trackEvent', category, action, label, value])
}

export const BaiduTrack = {
  chatOpen(source) {
    trackEvent('chat', 'open', source || 'unknown')
  },
  chatSend(extra = '') {
    trackEvent('chat', 'send', extra)
  },
  donateClick(channel = '') {
    trackEvent('donate', 'open_modal', channel)
  },
  donatePaySelect(channel) {
    trackEvent('donate', 'select_pay', channel)
  },
  chatSparkLink() {
    trackEvent('donate', 'from_chat', 'spark_link')
  },
  sharePosterGenerate(title = '') {
    trackEvent('share', 'poster_generate', title.slice(0, 80))
  },
}
