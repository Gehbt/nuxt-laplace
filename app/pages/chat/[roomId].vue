<script setup lang="ts">
import type { Chat as ChatType } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

import type { AiModelSettingField } from '~/components/chat/AiModelSettings.vue'
import type { ChatMessage } from '~/types/chat'

import userIcon from '~/assets/images/user-icon/common.png'
import AiModelSettings from '~/components/chat/AiModelSettings.vue'
import { useChat } from '~/composables/useChat'
import { useChatStore } from '~/stores/chat'

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

const store = useChatStore()
const { joinRoom, sendMessage, sendTyping, stopAi } = useChat()

// SSR prefetch: fetch messages for this room
const isDeepSeekRoom = computed(() => roomId.value === 'deepseek')

const { data: prefetchedMessages } = await useFetch<ChatMessage[]>(
  `/api/rooms/${roomId.value}/messages`,
  { key: `room-messages-${roomId.value}` },
)

if (prefetchedMessages.value && !isDeepSeekRoom.value) {
  store.messages[roomId.value] = prefetchedMessages.value
}

// DeepSeek AI chat — lazy-loaded only when entering the deepseek room
const AI_STORAGE_KEY = 'deepseek-ai-chat-messages'

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

type DeepseekModelOptions = {
  thinkingType: 'enabled' | 'disabled' | 'adaptive'
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}
const deepseekOptionsDefaults: DeepseekModelOptions = {
  thinkingType: 'enabled',
  reasoningEffort: 'high',
}

const deepseekOptions = useLocalStorage<DeepseekModelOptions>(DEEPSEEK_OPTIONS_KEY, {
  ...deepseekOptionsDefaults,
})

// Lazy-load AI SDK: Chat instance is only created when entering deepseek room
const aiChat = shallowRef<ChatType<UIMessage> | null>(null)
const aiMessagesAsChat = computed<ChatMessage[]>(() => {
  const chat = aiChat.value
  if (!chat) return []
  return chat.messages.map((m) => ({
    id: m.id,
    content:
      m.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || '',
    peerId: m.role === 'user' ? store.peerId.slice(0, 8) : 'ai:deepseek',
    timestamp: Date.now(),
  }))
})

const aiLoading = computed(() => {
  const chat = aiChat.value
  if (!chat) return false
  return chat.status === 'streaming' || chat.status === 'submitted'
})
const aiTypingPeerId = computed(() => (aiLoading.value ? 'ai:deepseek' : ''))

const aiStoredMessages = useLocalStorage<UIMessage[]>(AI_STORAGE_KEY, [])

async function initAiChat() {
  if (aiChat.value) return
  const [{ Chat }, { DefaultChatTransport }] = await Promise.all([
    import('@ai-sdk/vue'),
    import('ai'),
  ])
  aiChat.value = new Chat({
    transport: new DefaultChatTransport({ api: '/api/deepseek-chat' }),
    messages: aiStoredMessages.value,
  })
}

function saveAiMessages() {
  if (!aiChat.value) return
  aiStoredMessages.value = [...aiChat.value.messages]
}

function aiSend() {
  const chat = aiChat.value
  const text = aiInput.value.trim()
  if (!chat || !text || aiLoading.value) return
  chat.sendMessage(
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
let aiSaveTimer: number | null = null
onMounted(() => {
  aiSaveTimer = window.setInterval(() => {
    if (isDeepSeekRoom.value && aiChat.value && aiChat.value.messages.length > 0) {
      saveAiMessages()
    }
  }, 1000)
})
onUnmounted(() => {
  if (aiSaveTimer) window.clearInterval(aiSaveTimer)
  if (isDeepSeekRoom.value) saveAiMessages()
})

// Initialize AI chat lazily when entering deepseek room
watch(
  isDeepSeekRoom,
  (val) => {
    if (val) initAiChat()
  },
  { immediate: true },
)

// Join WebSocket room when entering a room
// Use onMounted to avoid hydration mismatch — currentRoomId changes the sidebar
// active-room class, which would differ between SSR and client if set during setup.
let joinedInitialRoom = false
onMounted(() => {
  if (roomId.value) {
    joinRoom(roomId.value)
    joinedInitialRoom = true
  }
})
watch(roomId, (newRoomId) => {
  if (!joinedInitialRoom) return
  if (newRoomId) joinRoom(newRoomId)
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- DeepSeek AI Chat (same components as regular rooms) -->
    <template v-if="isDeepSeekRoom">
      <ChatMessageList
        :messages="aiMessagesAsChat"
        :current-peer-id="store.peerId.slice(0, 8)"
        :typing-peer-id="aiTypingPeerId"
      />
      <div class="flex gap-2 p-4 border-t border-default">
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
        <UButton v-if="aiLoading" color="neutral" variant="subtle" @click="aiChat?.stop()">
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
</template>
