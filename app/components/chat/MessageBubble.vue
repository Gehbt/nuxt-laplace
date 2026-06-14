<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()

const isAi = computed(() => props.message.peerId === 'ai:deepseek')
const shortId = computed(() => props.message.peerId.slice(0, 8))
const time = computed(() => new Date(props.message.timestamp).toLocaleTimeString())

const hasContent = computed(() =>
  props.message.content.some((p) => {
    if (p.type === 'text') return p.text.length > 0
    return true
  }),
)

function openFullscreen(e: MouseEvent) {
  ;(e.currentTarget as HTMLImageElement).requestFullscreen?.()
}
</script>

<template>
  <div class="flex gap-2" :class="isOwn ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="max-w-[75%] rounded-lg px-3 py-2"
      :class="isOwn ? 'bg-green-500 text-white' : 'bg-elevated text-default'"
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
      <div class="space-y-1">
        <template v-for="(part, i) in message.content" :key="i">
          <div v-if="part.type === 'text'" class="wrap-break-word">
            {{ part.text }}
          </div>
          <div v-else-if="part.type === 'image'" class="mt-1">
            <img
              :src="part.url"
              alt="Shared image"
              class="max-w-full max-h-80 rounded-md cursor-pointer"
              loading="lazy"
              @click="openFullscreen"
            />
          </div>
        </template>
        <span
          v-if="isAi && !hasContent"
          class="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse"
        />
      </div>
    </div>
  </div>
</template>
