<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  messages: ChatMessage[]
  currentPeerId: string
  typingPeerId: string
}>()

const listRef = ref<HTMLElement | null>(null)

watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      if (listRef.value) {
        listRef.value.scrollTop = listRef.value.scrollHeight
      }
    })
  },
)
</script>

<template>
  <div ref="listRef" class="flex-1 overflow-y-auto p-4 space-y-3">
    <div v-for="msg in messages" :key="msg.id">
      <ChatMessageBubble :message="msg" :is-own="msg.peerId === currentPeerId" />
    </div>
    <ChatTypingIndicator :peer-id="typingPeerId" />
    <div v-if="messages.length === 0" class="text-center text-dimmed mt-8">
      No messages yet. Say hello!
    </div>
  </div>
</template>
