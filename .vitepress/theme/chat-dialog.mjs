import { ref } from 'vue'

export const chatDialog = ref({
  visible: false,
  mode: 'alert',
  title: '提示',
  message: '',
  inputValue: '',
  confirmText: '确定',
  cancelText: '取消',
})

let finishDialog = null

function openDialog(payload) {
  return new Promise((resolve) => {
    chatDialog.value = {
      visible: true,
      confirmText: '确定',
      cancelText: '取消',
      inputValue: '',
      ...payload,
    }
    finishDialog = resolve
  })
}

export function showChatAlert(message, title = '提示') {
  return openDialog({ mode: 'alert', title, message })
}

export function showChatConfirm(message, title = '请确认') {
  return openDialog({ mode: 'confirm', title, message })
}

export function showChatPrompt(title, defaultValue = '', message = '') {
  return openDialog({
    mode: 'prompt',
    title,
    message,
    inputValue: defaultValue,
  })
}

/**
 * @param {boolean|string|null} result
 */
export function resolveChatDialog(result) {
  if (finishDialog) {
    finishDialog(result)
    finishDialog = null
  }
  chatDialog.value.visible = false
}

export function cancelChatDialog() {
  const mode = chatDialog.value.mode
  resolveChatDialog(mode === 'prompt' ? null : false)
}

export function confirmChatDialog() {
  const { mode, inputValue } = chatDialog.value
  if (mode === 'prompt') {
    const trimmed = (inputValue || '').trim()
    if (!trimmed) return
    resolveChatDialog(trimmed)
    return
  }
  resolveChatDialog(true)
}
