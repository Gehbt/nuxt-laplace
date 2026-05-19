<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const route = useRoute()
const roomId = computed(() => route.params.roomId as string)

const store = useChatStore()
const { joinRoom, sendMessage, sendTyping, createRoom } = useChat()

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
      :online-users="store.currentOnlineUsers"
      :total-online="store.totalOnline"
      @select-room="(id: string) => navigateTo(`/chat/${id}`)"
      @create-room="createRoom"
      @join-room="(id: string) => navigateTo(`/chat/${id}`)"
    />
    <div class="flex-1 flex flex-col">
      <div
        class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold flex items-center gap-2"
      >
        <span># {{ store.currentRoomId }}</span>
        <span v-if="!store.connected" class="text-sm text-red-500 font-normal">
          (Connecting...)
        </span>
        <span class="flex-1" />
        <UBadge v-if="store.peerId" variant="subtle" size="sm">
          ID: {{ store.peerId.slice(0, 8) }}
        </UBadge>
      </div>
      <ChatMessageList
        :messages="store.currentMessages"
        :current-peer-id="store.peerId"
        :typing-peer-id="store.typingPeerId"
      />
      <ChatMessageInput @send="sendMessage" @typing="sendTyping" />
    </div>
  </div>
</template>
