<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()

const isAi = computed(() => props.message.peerId === 'ai:deepseek')
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
        <template v-if="isAi">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-bot" class="size-3" />
            DeepSeek
          </span>
        </template>
        <template v-else> User {{ shortId }} </template>
        <span class="ml-2">{{ time }}</span>
      </div>
      <div class="wrap-break-word">
        {{ message.content
        }}<span
          v-if="isAi && !message.content"
          class="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse"
        />
      </div>
    </div>
  </div>
</template>
