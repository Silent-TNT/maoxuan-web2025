<script setup>
import { nextTick, ref, watch } from 'vue'
import {
  chatDialog,
  cancelChatDialog,
  confirmChatDialog,
} from '../chat-dialog.mjs'

const inputRef = ref(null)

watch(
  () => chatDialog.value.visible,
  async (visible) => {
    if (visible && chatDialog.value.mode === 'prompt') {
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  },
)

function onKeydown(e) {
  if (e.key === 'Escape') cancelChatDialog()
  if (e.key === 'Enter' && chatDialog.value.mode === 'prompt') {
    e.preventDefault()
    confirmChatDialog()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="chat-dialog-fade">
      <div
        v-if="chatDialog.visible"
        class="chat-dialog-overlay"
        @click.self="cancelChatDialog"
        @keydown="onKeydown"
      >
        <div class="chat-dialog-card" role="dialog" aria-modal="true">
          <h3 class="chat-dialog-title">{{ chatDialog.title }}</h3>
          <p v-if="chatDialog.message" class="chat-dialog-message">
            {{ chatDialog.message }}
          </p>
          <input
            v-if="chatDialog.mode === 'prompt'"
            ref="inputRef"
            v-model="chatDialog.inputValue"
            type="text"
            class="chat-dialog-input"
            maxlength="48"
            @keydown.enter.prevent="confirmChatDialog"
          />
          <div class="chat-dialog-actions">
            <button
              v-if="chatDialog.mode !== 'alert'"
              type="button"
              class="chat-dialog-btn ghost"
              @click="cancelChatDialog"
            >
              {{ chatDialog.cancelText }}
            </button>
            <button
              type="button"
              class="chat-dialog-btn primary"
              @click="confirmChatDialog"
            >
              {{ chatDialog.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chat-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 200001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
}

.chat-dialog-card {
  width: 100%;
  max-width: 360px;
  padding: 22px 22px 18px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-1, #213547);
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.chat-dialog-title {
  margin: 0 0 10px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.02em;
}

.chat-dialog-message {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2, #476582);
}

.chat-dialog-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 18px;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 8px;
  font-size: 15px;
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-1, #213547);
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.chat-dialog-input:focus {
  border-color: var(--vp-c-brand-1, #c82829);
  background: var(--vp-c-bg, #fff);
}

.chat-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.chat-dialog-btn {
  min-width: 72px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s ease, background 0.2s ease;
}
.chat-dialog-btn.ghost {
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-2, #476582);
}
.chat-dialog-btn.ghost:hover {
  background: var(--vp-c-divider, #e2e2e3);
  color: var(--vp-c-text-1, #213547);
}
.chat-dialog-btn.primary {
  background: var(--vp-c-brand-1, #c82829);
  color: #fff;
}
.chat-dialog-btn.primary:hover {
  opacity: 0.9;
}

.chat-dialog-fade-enter-active,
.chat-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.chat-dialog-fade-enter-active .chat-dialog-card,
.chat-dialog-fade-leave-active .chat-dialog-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.chat-dialog-fade-enter-from,
.chat-dialog-fade-leave-to {
  opacity: 0;
}
.chat-dialog-fade-enter-from .chat-dialog-card,
.chat-dialog-fade-leave-to .chat-dialog-card {
  transform: scale(0.96) translateY(6px);
  opacity: 0;
}
</style>
