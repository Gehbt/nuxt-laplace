<script setup lang="ts">
import type { Room } from '~/types/chat'

defineProps<{
  rooms: Room[]
  currentRoomId: string
  onlineUsers: string[]
  totalOnline: number
}>()

const emit = defineEmits<{
  selectRoom: [roomId: string]
  createRoom: [name: string]
  joinRoom: [roomId: string]
}>()

const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const newRoomName = ref('')
const joinRoomId = ref('')

function handleCreateRoom() {
  const name = newRoomName.value.trim()
  if (!name) return
  emit('createRoom', name)
  newRoomName.value = ''
  showCreateDialog.value = false
}

function handleJoinRoom() {
  const id = joinRoomId.value.trim().toLowerCase()
  if (!id) return
  emit('joinRoom', id)
  joinRoomId.value = ''
  showJoinDialog.value = false
}
</script>

<template>
  <div class="w-64 shrink-0 border-r border-default flex flex-col h-full">
    <div class="p-4 border-b border-default">
      <h2 class="text-lg font-semibold">Chat Rooms</h2>
      <p class="text-xs text-muted mt-1">
        {{ totalOnline }} user{{ totalOnline !== 1 ? 's' : '' }} connected
      </p>
    </div>

    <div class="flex-1 overflow-y-auto">
      <button
        v-for="room in rooms"
        :key="room.id"
        class="w-full text-left px-4 py-2 hover:bg-elevated/50 transition-colors"
        :class="room.id === currentRoomId ? 'bg-green-500/10 text-green-500' : 'text-default'"
        @click="emit('selectRoom', room.id)"
      >
        <div class="font-medium"># {{ room.name }}</div>
      </button>

      <div v-if="rooms.length === 0" class="px-4 py-2 text-dimmed text-sm">No rooms yet</div>
    </div>

    <div class="p-4 border-t border-default">
      <div v-if="onlineUsers.length > 0" class="mb-3">
        <h3 class="text-xs font-semibold text-muted uppercase mb-1">
          Online ({{ onlineUsers.length }})
        </h3>
        <div v-for="userId in onlineUsers" :key="userId" class="text-sm text-default truncate">
          User {{ userId.slice(0, 8) }}
        </div>
      </div>

      <UButton block variant="outline" @click="showCreateDialog = true"> + New Room </UButton>
      <UButton block variant="outline" class="mt-2" @click="showJoinDialog = true">
        Join Room
      </UButton>
    </div>

    <div
      v-if="showCreateDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showCreateDialog = false"
    >
      <div class="bg-default rounded-lg p-6 w-80 shadow-xl">
        <h3 class="text-lg font-semibold mb-4">Create Room</h3>
        <UInput
          v-model="newRoomName"
          placeholder="Room name"
          class="mb-4"
          @keydown.enter="handleCreateRoom"
        />
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" @click="showCreateDialog = false"> Cancel </UButton>
          <UButton :disabled="!newRoomName.trim()" @click="handleCreateRoom"> Create </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="showJoinDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showJoinDialog = false"
    >
      <div class="bg-default rounded-lg p-6 w-80 shadow-xl">
        <h3 class="text-lg font-semibold mb-4">Join Room</h3>
        <UInput
          v-model="joinRoomId"
          placeholder="Room ID"
          class="mb-4"
          @keydown.enter="handleJoinRoom"
        />
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" @click="showJoinDialog = false"> Cancel </UButton>
          <UButton :disabled="!joinRoomId.trim()" @click="handleJoinRoom"> Join </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
