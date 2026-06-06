<script setup lang="ts">
import type { Room } from '~/types/chat'

import { useChat } from '~/composables/useChat'
import { useChatStore } from '~/stores/chat'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const store = useChatStore()
const { createRoom } = useChat()

const roomId = computed(() => route.params.roomId as string)
const isDeepSeekRoom = computed(() => roomId.value === 'deepseek')

// SSR prefetch: fetch rooms via HTTP API
const { data: prefetchedRooms } = await useFetch<Room[]>('/api/rooms', { key: 'rooms' })

if (prefetchedRooms.value) {
  store.rooms = prefetchedRooms.value
}
</script>

<template>
  <div class="h-[calc(100dvh-4rem)] flex bg-default">
    <ChatRoomSidebar
      :rooms="store.rooms"
      :current-room-id="store.currentRoomId"
      :online-users="store.currentOnlineUsers.filter((id) => id !== store.peerId)"
      :total-online="store.totalOnline"
      @select-room="(id: string) => navigateTo(`/chat/${id}`)"
      @create-room="createRoom"
      @join-room="(id: string) => navigateTo(`/chat/${id}`)"
    />
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header — shared across all rooms -->
      <div class="px-4 py-3 border-b border-default font-semibold flex items-center gap-2">
        <span># {{ store.currentRoomId }}</span>
        <template v-if="!isDeepSeekRoom">
          <span>
            <span
              class="text-sm font-normal"
              :class="store.connected ? 'text-green-500' : 'text-red-500'"
            >
              ({{ store.connected ? 'Connected' : 'Connecting ...' }})
            </span>
          </span>
          <span class="flex-1" />
          <UBadge v-if="store.peerId" variant="subtle" size="sm">
            ID: {{ store.peerId.slice(0, 8) }}
          </UBadge>
        </template>
        <UBadge v-else variant="subtle" size="sm" color="primary"> AI Chat </UBadge>
      </div>
      <NuxtPage />
    </div>
  </div>
</template>
