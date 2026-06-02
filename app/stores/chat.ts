import { defineStore } from 'pinia'
import type { ChatMessage, Room, ServerMessage } from '~/types/chat'

export const useChatStore = defineStore('chat', {
  state: () => ({
    peerId: '' as string,
    currentRoomId: '' as string,
    rooms: [] as Room[],
    messages: {} as Record<string, ChatMessage[]>,
    onlineUsers: {} as Record<string, string[]>,
    typingPeerId: '' as string,
    connected: false,
    isAiGenerating: false,
    totalOnline: 0,
  }),

  getters: {
    currentMessages(state): ChatMessage[] {
      return state.messages[state.currentRoomId] || []
    },
    currentOnlineUsers(state): string[] {
      return state.onlineUsers[state.currentRoomId] || []
    },
  },

  actions: {
    handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case 'welcome':
          this.peerId = msg.peerId
          break

        case 'chat': {
          const roomId = this.currentRoomId
          if (!this.messages[roomId]) {
            this.messages[roomId] = []
          }
          this.messages[roomId].push(msg.message)
          break
        }

        case 'typing':
          if (msg.peerId !== this.peerId) {
            this.typingPeerId = msg.peerId
            setTimeout(() => {
              if (this.typingPeerId === msg.peerId) {
                this.typingPeerId = ''
              }
            }, 3000)
          }
          break

        case 'user-joined':
          this.onlineUsers[this.currentRoomId] = msg.onlineUsers
          break

        case 'user-left':
          this.onlineUsers[this.currentRoomId] = msg.onlineUsers
          break

        case 'history':
          this.messages[this.currentRoomId] = msg.messages
          break

        case 'room-created':
          if (!this.rooms.find((r) => r.id === msg.room.id)) {
            this.rooms.push(msg.room)
          }
          break

        case 'rooms':
          this.rooms = msg.rooms
          break

        case 'online-count':
          this.totalOnline = msg.count
          break

        case 'room-left':
          if (msg.peerId === this.peerId) {
            useToast().add({
              title: `你已经退出 ${msg.roomId} 房间`,
              color: 'neutral',
              icon: 'i-lucide-log-out',
            })
          }
          break

        case 'ai-start': {
          this.isAiGenerating = true
          const roomMsgs = this.messages[msg.roomId] || []
          this.messages[msg.roomId] = roomMsgs
          roomMsgs.push({
            id: msg.id,
            content: '',
            peerId: msg.peerId,
            timestamp: msg.timestamp,
          })
          break
        }

        case 'ai-chunk': {
          const chunkMessages = this.messages[msg.roomId]
          if (chunkMessages) {
            const target = chunkMessages.find((m) => m.id === msg.id)
            if (target) {
              target.content += msg.text
            }
          }
          break
        }

        case 'ai-end':
          this.isAiGenerating = false
          break

        case 'ai-stop': {
          this.isAiGenerating = false
          const stopMessages = this.messages[msg.roomId]
          if (stopMessages) {
            const idx = stopMessages.findIndex((m) => m.id === msg.id)
            if (idx !== -1) {
              stopMessages.splice(idx, 1)
            }
          }
          break
        }
      }
    },
  },
})
