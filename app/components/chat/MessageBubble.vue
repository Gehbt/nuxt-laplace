<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()

const shortId = computed(() => props.message.peerId.slice(0, 8))
const time = computed(() => new Date(props.message.timestamp).toLocaleTimeString())
</script>

<template>
  <div class="flex gap-2" :class="isOwn ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="max-w-[75%] rounded-lg px-3 py-2"
      :class="
        isOwn
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      "
    >
      <div class="text-xs opacity-70 mb-1">
        User {{ shortId }}
        <span class="ml-2">{{ time }}</span>
      </div>
      <div class="break-words">{{ message.content }}</div>
    </div>
  </div>
</template>
