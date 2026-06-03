<script setup lang="ts">
import { DefaultChatTransport } from 'ai'
import { Chat } from '@ai-sdk/vue'
import { useChatStore } from '@/stores/chat'
import { useChat } from '~/composables/useChat'
import type { ChatMessage } from '~/types/chat'
import userIcon from '~/assets/images/user-icon/common.png'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

const store = useChatStore()
const { joinRoom, sendMessage, sendTyping, createRoom, stopAi } = useChat()

// DeepSeek AI chat (HTTP streaming via Chat class)
const AI_STORAGE_KEY = 'deepseek-ai-chat-messages'
const AI_SELF_PEER_ID = '__ai_self__'
const isDeepSeekRoom = computed(() => roomId.value === 'deepseek')

const aiInput = ref('')

function loadAiMessages() {
  if (!import.meta.client) return []
  try {
    return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const aiChat = new Chat({
  transport: new DefaultChatTransport({ api: '/api/deepseek-chat' }),
  messages: loadAiMessages(),
})

function saveAiMessages() {
  if (!import.meta.client) return
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiChat.messages))
}

// Convert UIMessage[] to ChatMessage[] for reuse with ChatMessageList/Bubble
const aiMessagesAsChat = computed<ChatMessage[]>(() =>
  aiChat.messages.map((m) => ({
    id: m.id,
    content:
      m.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || '',
    peerId: m.role === 'user' ? AI_SELF_PEER_ID : 'ai:deepseek',
    timestamp: Date.now(),
  })),
)

const aiLoading = computed(() => aiChat.status === 'streaming' || aiChat.status === 'submitted')
const aiTypingPeerId = computed(() => (aiLoading.value ? 'ai:deepseek' : ''))

function aiSend() {
  const text = aiInput.value.trim()
  if (!text || aiLoading.value) return
  aiChat.sendMessage({ text })
  aiInput.value = ''
}

function aiHandleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    aiSend()
  }
}

// Auto-save AI messages to localStorage
let aiSaveTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  aiSaveTimer = setInterval(() => {
    if (isDeepSeekRoom.value && aiChat.messages.length > 0) {
      saveAiMessages()
    }
  }, 1000)
})
onUnmounted(() => {
  if (aiSaveTimer) clearInterval(aiSaveTimer)
  if (isDeepSeekRoom.value) saveAiMessages()
})

// Join WebSocket room for all rooms (sidebar needs it)
watch(
  roomId,
  (newRoomId) => {
    if (newRoomId) {
      joinRoom(newRoomId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-[calc(100dvh-4rem)] flex bg-white dark:bg-gray-900">
    <ChatRoomSidebar
      :rooms="store.rooms"
      :current-room-id="store.currentRoomId"
      :online-users="store.currentOnlineUsers.filter((id) => id !== store.peerId)"
      :total-online="store.totalOnline"
      @select-room="(id: string) => navigateTo(`/chat/${id}`)"
      @create-room="createRoom"
      @join-room="(id: string) => navigateTo(`/chat/${id}`)"
    />
    <div class="flex-1 flex flex-col">
      <!-- Header -->
      <div
        class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold flex items-center gap-2"
      >
        <span># {{ store.currentRoomId }}</span>
        <span v-if="!isDeepSeekRoom">
          <span v-if="!store.connected" class="text-sm text-red-500 font-normal">
            (Connecting...)
          </span>
          <span v-else class="text-sm text-green-500 font-normal"> (Connected) </span>
        </span>
        <span class="flex-1" />
        <UBadge v-if="store.peerId && !isDeepSeekRoom" variant="subtle" size="sm">
          ID: {{ store.peerId.slice(0, 8) }}
        </UBadge>
        <UBadge v-if="isDeepSeekRoom" variant="subtle" size="sm" color="primary"> AI Chat </UBadge>
      </div>

      <!-- DeepSeek AI Chat (same components as regular rooms) -->
      <template v-if="isDeepSeekRoom">
        <ChatMessageList
          :messages="aiMessagesAsChat"
          :current-peer-id="AI_SELF_PEER_ID"
          :typing-peer-id="aiTypingPeerId"
        />
        <div class="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <UAvatar class="w-8 h-8" :src="userIcon" />
          <div class="w-1" />
          <UInput
            v-model="aiInput"
            :placeholder="aiLoading ? 'AI is thinking...' : 'Type a message...'"
            :disabled="aiLoading"
            class="flex-1"
            @keydown="aiHandleKeydown"
          />
          <UButton v-if="aiLoading" color="neutral" variant="subtle" @click="aiChat.stop()">
            <UIcon name="i-lucide-square" class="size-4" />
            Stop
          </UButton>
          <UButton v-else :disabled="!aiInput.trim()" @click="aiSend"> Send </UButton>
        </div>
      </template>

      <!-- Regular Room Chat -->
      <template v-else>
        <ChatMessageList
          :messages="store.currentMessages"
          :current-peer-id="store.peerId"
          :typing-peer-id="store.typingPeerId"
        />
        <ChatMessageInput @send="sendMessage" @typing="sendTyping" @stop="stopAi" />
      </template>
    </div>
  </div>
</template>
