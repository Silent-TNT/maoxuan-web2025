<script setup>
import {
  sharePicker,
  sharePickerQuoteLength,
  closeSharePicker,
  toggleShareItem,
  setAllShareItems,
  confirmSharePicker,
} from '../share-picker.mjs'
import { showChatAlert } from '../chat-dialog.mjs'

const MAX_LEN = 1500

async function onConfirm() {
  const selected = sharePicker.value.items.filter((i) => i.selected).length
  if (!selected) {
    await showChatAlert('请至少选择一条对话内容。', '选择分享内容')
    return
  }
  if (!confirmSharePicker()) {
    await showChatAlert('所选内容过短，无法生成金句卡片。', '暂无法分享')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="chat-dialog-fade">
      <div
        v-if="sharePicker.visible"
        class="share-picker-overlay"
        @click.self="closeSharePicker"
      >
        <div class="share-picker-card" role="dialog" aria-modal="true">
          <h3 class="share-picker-title">选择分享内容</h3>
          <p class="share-picker-hint">可多选或取消，问答均可纳入金句卡片。</p>

          <div class="share-picker-toolbar">
            <button type="button" class="toolbar-btn" @click="setAllShareItems(true)">
              全选
            </button>
            <button type="button" class="toolbar-btn" @click="setAllShareItems(false)">
              全不选
            </button>
            <span class="char-count" :class="{ warn: sharePickerQuoteLength > MAX_LEN }">
              {{ sharePickerQuoteLength }} / {{ MAX_LEN }} 字
            </span>
          </div>

          <ul class="share-picker-list">
            <li
              v-for="item in sharePicker.items"
              :key="item.index"
              class="share-picker-item"
              :class="{ selected: item.selected }"
            >
              <label class="share-picker-label">
                <input
                  type="checkbox"
                  :checked="item.selected"
                  @change="toggleShareItem(item.index)"
                />
                <div class="item-body">
                  <span class="role-tag" :class="item.role">{{ item.label }}</span>
                  <span class="item-preview">{{ item.preview }}</span>
                </div>
              </label>
            </li>
          </ul>

          <div class="share-picker-actions">
            <button type="button" class="picker-btn ghost" @click="closeSharePicker">
              取消
            </button>
            <button type="button" class="picker-btn primary" @click="onConfirm">
              生成金句卡片
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.share-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 200001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.share-picker-card {
  width: 100%;
  max-width: 420px;
  max-height: min(80vh, 560px);
  display: flex;
  flex-direction: column;
  padding: 20px 20px 16px;
  background: var(--vp-c-bg, #fff);
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.share-picker-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
}

.share-picker-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vp-c-text-3, #939aa3);
  line-height: 1.5;
}

.share-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 6px;
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-2, #476582);
  cursor: pointer;
}
.toolbar-btn:hover {
  border-color: var(--vp-c-text-3, #939aa3);
  color: var(--vp-c-text-1, #213547);
}

.char-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3, #939aa3);
}
.char-count.warn {
  color: var(--vp-c-brand-1, #c82829);
}

.share-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 120px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 8px;
}

.share-picker-item {
  border-bottom: 1px solid var(--vp-c-divider, #e2e2e3);
}
.share-picker-item:last-child {
  border-bottom: none;
}
.share-picker-item.selected {
  background: var(--vp-c-bg-soft, #f6f6f7);
}
.share-picker-item:has(.role-tag.user) + .share-picker-item:has(.role-tag.assistant),
.share-picker-item:has(.role-tag.assistant) + .share-picker-item:has(.role-tag.user) {
  box-shadow: inset 0 1px 0 var(--vp-c-divider, #e2e2e3);
}

.share-picker-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.45;
}

.share-picker-label input {
  margin-top: 4px;
  flex-shrink: 0;
  accent-color: var(--vp-c-brand-1, #c82829);
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.role-tag {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.role-tag.user {
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-2, #476582);
}
.role-tag.assistant {
  background: var(--vp-c-brand-soft, #f8e6e6);
  color: var(--vp-c-brand-1, #c82829);
}

.item-preview {
  color: var(--vp-c-text-1, #213547);
  word-break: break-word;
  line-height: 1.5;
  padding-left: 2px;
}

.share-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
  flex-shrink: 0;
}

.picker-btn {
  min-width: 88px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.picker-btn.ghost {
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-2, #476582);
}
.picker-btn.primary {
  background: var(--vp-c-brand-1, #c82829);
  color: #fff;
}
.picker-btn.primary:hover {
  opacity: 0.9;
}

.chat-dialog-fade-enter-active,
.chat-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.chat-dialog-fade-enter-active .share-picker-card,
.chat-dialog-fade-leave-active .share-picker-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.chat-dialog-fade-enter-from,
.chat-dialog-fade-leave-to {
  opacity: 0;
}
.chat-dialog-fade-enter-from .share-picker-card,
.chat-dialog-fade-leave-to .share-picker-card {
  transform: scale(0.96) translateY(6px);
  opacity: 0;
}
</style>
