<script setup lang="ts">
import userIcon from '~/assets/images/user-icon/common.png'

const emit = defineEmits<{
  send: [content: string]
  typing: []
  stop: []
}>()

const store = useChatStore()
const input = ref('')
let typingTimer: ReturnType<typeof setTimeout> | null = null

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}

function sendMessage() {
  const content = input.value.trim()
  if (!content || store.isAiGenerating) return
  emit('send', content)
  input.value = ''
}

function handleInput() {
  if (typingTimer) clearTimeout(typingTimer)
  emit('typing')
  typingTimer = setTimeout(() => {
    typingTimer = null
  }, 2000)
}
</script>

<template>
  <div class="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
    <UAvatar class="w-8 h-8" :src="userIcon" />
    <div class="w-1" />
    <UInput
      v-model="input"
      :placeholder="store.isAiGenerating ? 'AI is thinking...' : 'Type a message...'"
      :disabled="store.isAiGenerating"
      class="flex-1"
      @keydown="handleKeydown"
      @input="handleInput"
    />
    <UButton v-if="store.isAiGenerating" color="neutral" variant="subtle" @click="emit('stop')">
      <UIcon name="i-lucide-square" class="size-4" />
      Stop
    </UButton>
    <UButton v-else :disabled="!input.trim()" @click="sendMessage"> Send </UButton>
  </div>
</template>
