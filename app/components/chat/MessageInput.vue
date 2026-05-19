<script setup lang="ts">
const emit = defineEmits<{
  send: [content: string]
  typing: []
}>()

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
  if (!content) return
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
    <UInput
      v-model="input"
      placeholder="Type a message..."
      class="flex-1"
      @keydown="handleKeydown"
      @input="handleInput"
    />
    <UButton :disabled="!input.trim()" @click="sendMessage"> Send </UButton>
  </div>
</template>
