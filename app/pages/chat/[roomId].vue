<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

const store = useChatStore()
const { joinRoom, sendMessage, sendTyping, createRoom, stopAi } = useChat()

// DeepSeek AI chat (HTTP streaming via Chat class)
const AI_STORAGE_KEY = 'deepseek-ai-chat-messages'
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

const aiLoading = computed(() => aiChat.status === 'streaming' || aiChat.status === 'submitted')

function aiHandleSubmit(e?: Event) {
  e?.preventDefault()
  const text = aiInput.value.trim()
  if (!text) return
  aiChat.sendMessage({ text })
  aiInput.value = ''
}

function aiHandleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    aiHandleSubmit()
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

      <!-- DeepSeek AI Chat -->
      <template v-if="isDeepSeekRoom">
        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800 min-h-0">
          <div v-if="aiChat.messages.length === 0" class="text-center text-gray-400 mt-20">
            Send a message to start chatting with DeepSeek
          </div>
          <template v-for="message in aiChat.messages" :key="message.id">
            <div
              :class="[
                'p-3 rounded-lg max-w-[80%]',
                message.role === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900 ml-auto'
                  : 'bg-white dark:bg-gray-700 mr-auto',
              ]"
            >
              <div class="text-xs text-gray-500 mb-1 font-medium">
                {{ message.role === 'user' ? 'You' : 'DeepSeek' }}
              </div>
              <template
                v-for="(part, index) in message.parts"
                :key="`${message.id}-${part.type}-${index}`"
              >
                <div v-if="part.type === 'text'" class="whitespace-pre-wrap">
                  {{ part.text }}
                </div>
              </template>
            </div>
          </template>
          <div v-if="aiLoading" class="text-center text-gray-400 text-sm">Thinking...</div>
        </div>
        <form
          class="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700"
          @submit="aiHandleSubmit"
        >
          <UInput
            v-model="aiInput"
            placeholder="Type a message..."
            class="flex-1"
            @keydown="aiHandleKeydown"
          />
          <UButton type="submit" :disabled="aiLoading || !aiInput.trim()"> Send </UButton>
          <UButton v-if="aiLoading" variant="ghost" @click="aiChat.stop()"> Stop </UButton>
        </form>
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
