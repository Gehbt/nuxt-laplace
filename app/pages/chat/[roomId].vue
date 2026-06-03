<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'

import type { AiModelSettingField } from '~/components/chat/AiModelSettings.vue'
import type { ChatMessage } from '~/types/chat'

import { useChatStore } from '@/stores/chat'
import userIcon from '~/assets/images/user-icon/common.png'
import AiModelSettings from '~/components/chat/AiModelSettings.vue'
import { useChat } from '~/composables/useChat'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

const store = useChatStore()
const { joinRoom, sendMessage, sendTyping, createRoom, stopAi } = useChat()

// DeepSeek AI chat (HTTP streaming via Chat class)
const AI_STORAGE_KEY = 'deepseek-ai-chat-messages'
const isDeepSeekRoom = computed(() => roomId.value === 'deepseek')

const aiInput = ref('')

const deepseekFields: AiModelSettingField[] = [
  {
    key: 'thinkingType',
    label: 'Thinking',
    type: 'select',
    options: [
      { label: 'Adaptive', value: 'adaptive' },
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' },
    ],
  },
  {
    key: 'reasoningEffort',
    label: 'Reasoning Effort',
    type: 'select',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' },
      { label: 'Max', value: 'max' },
    ],
  },
]

const DEEPSEEK_OPTIONS_KEY = 'deepseek-model-options'
const deepseekOptionsDefaults = { thinkingType: 'enabled', reasoningEffort: 'high' }

function loadDeepseekOptions() {
  if (!import.meta.client) return { ...deepseekOptionsDefaults }
  try {
    return {
      ...deepseekOptionsDefaults,
      ...JSON.parse(localStorage.getItem(DEEPSEEK_OPTIONS_KEY) || '{}'),
    }
  } catch {
    return { ...deepseekOptionsDefaults }
  }
}

const deepseekOptions = ref(loadDeepseekOptions())

watch(
  deepseekOptions,
  (val) => {
    if (import.meta.client) localStorage.setItem(DEEPSEEK_OPTIONS_KEY, JSON.stringify(val))
  },
  { deep: true },
)

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
    peerId: m.role === 'user' ? store.peerId.slice(0, 8) : 'ai:deepseek',
    timestamp: Date.now(),
  })),
)

const aiLoading = computed(() => aiChat.status === 'streaming' || aiChat.status === 'submitted')
const aiTypingPeerId = computed(() => (aiLoading.value ? 'ai:deepseek' : ''))

function aiSend() {
  const text = aiInput.value.trim()
  if (!text || aiLoading.value) return
  aiChat.sendMessage(
    { text },
    {
      body: {
        providerOptions: {
          deepseek: {
            thinking: { type: deepseekOptions.value.thinkingType },
            reasoningEffort: deepseekOptions.value.reasoningEffort,
          },
        },
      },
    },
  )
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
        <ClientOnly>
          <ChatMessageList
            :messages="aiMessagesAsChat"
            :current-peer-id="store.peerId.slice(0, 8)"
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
            <AiModelSettings v-model="deepseekOptions" :fields="deepseekFields" />
            <UButton v-if="aiLoading" color="neutral" variant="subtle" @click="aiChat.stop()">
              <UIcon name="i-lucide-square" class="size-4" />
              Stop
            </UButton>
            <UButton v-else :disabled="!aiInput.trim()" @click="aiSend"> Send </UButton>
          </div>
        </ClientOnly>
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
