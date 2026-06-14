<script setup lang="ts">
import type { MessagePart } from '~/types/chat'

import { useChatStore } from '@/stores/chat'
import userIcon from '~/assets/images/user-icon/common.png'

const emit = defineEmits<{
  send: [content: MessagePart[]]
  typing: []
  stop: []
}>()

const store = useChatStore()
const input = ref('')
const pendingImages = ref<{ url: string; file: File }[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
let typingTimer: ReturnType<typeof setTimeout> | null = null

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
    })
    return res.url
  } catch {
    return null
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files) return
  for (const file of Array.from(target.files)) {
    if (!file.type.startsWith('image/')) continue
    const previewUrl = URL.createObjectURL(file)
    pendingImages.value.push({ url: previewUrl, file })
  }
  target.value = ''
}

function removePendingImage(index: number) {
  const removed = pendingImages.value.splice(index, 1)[0]
  if (removed) URL.revokeObjectURL(removed.url)
}

async function sendMessage() {
  const text = input.value.trim()
  const hasImages = pendingImages.value.length > 0
  if ((!text && !hasImages) || store.isAiGenerating) return

  const parts: MessagePart[] = []
  if (text) {
    parts.push({ type: 'text', text })
  }

  for (const pending of pendingImages.value) {
    const url = await uploadImage(pending.file)
    if (url) {
      parts.push({ type: 'image', url })
    }
    URL.revokeObjectURL(pending.url)
  }

  if (parts.length === 0) return

  emit('send', parts)
  input.value = ''
  pendingImages.value = []
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}

function handleInput() {
  if (typingTimer) clearTimeout(typingTimer)
  emit('typing')
  typingTimer = setTimeout(() => {
    typingTimer = null
  }, 2000)
}

function triggerFileSelect() {
  fileInput.value?.click()
}

const canSend = computed(() => !!input.value.trim() || pendingImages.value.length > 0)
</script>

<template>
  <div class="p-4 border-t border-default">
    <div v-if="pendingImages.length > 0" class="flex gap-2 mb-2 flex-wrap">
      <div v-for="(img, i) in pendingImages" :key="img.url" class="relative group">
        <img
          :src="img.url"
          alt="Pending upload"
          class="w-20 h-20 object-cover rounded-lg border border-default"
        />
        <button
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          @click="removePendingImage(i)"
        >
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
      </div>
    </div>

    <div class="flex gap-2">
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
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="store.isAiGenerating"
        @click="triggerFileSelect"
      >
        <UIcon name="i-lucide-image-plus" class="size-4" />
      </UButton>
      <UButton v-if="store.isAiGenerating" color="neutral" variant="subtle" @click="emit('stop')">
        <UIcon name="i-lucide-square" class="size-4" />
        Stop
      </UButton>
      <UButton v-else :disabled="!canSend" @click="sendMessage"> Send </UButton>
    </div>
  </div>
</template>
