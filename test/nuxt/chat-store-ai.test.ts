import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../app/stores/chat'

describe('chat store — AI message handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function storeWithRoom(roomId: string) {
    const store = useChatStore()
    store.currentRoomId = roomId
    store.messages[roomId] = []
    return store
  }

  describe('ai-start', () => {
    it('inserts an empty AI message and sets isAiGenerating', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      expect(store.isAiGenerating).toBe(true)
      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0]).toEqual({
        id: 'msg-1',
        content: '',
        peerId: 'ai:deepseek',
        timestamp: 1000,
      })
    })
  })

  describe('ai-chunk', () => {
    it('appends text to the matching AI message', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: 'Hello',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: ' world',
        roomId: 'deepseek',
        timestamp: 1002,
      })

      const msg = store.currentMessages.find((m) => m.id === 'msg-1')!
      expect(msg.content).toBe('Hello world')
    })

    it('ignores chunks for unknown message ids', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-chunk',
        id: 'unknown',
        text: 'orphan',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      expect(store.currentMessages).toHaveLength(0)
    })
  })

  describe('ai-end', () => {
    it('sets isAiGenerating to false', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })
      expect(store.isAiGenerating).toBe(true)

      store.handleMessage({
        type: 'ai-end',
        id: 'msg-1',
        roomId: 'deepseek',
        timestamp: 2000,
      })
      expect(store.isAiGenerating).toBe(false)
      expect(store.currentMessages).toHaveLength(1)
    })
  })

  describe('ai-stop', () => {
    it('removes the incomplete AI message and sets isAiGenerating to false', () => {
      const store = storeWithRoom('deepseek')

      store.handleMessage({
        type: 'ai-start',
        id: 'msg-1',
        peerId: 'ai:deepseek',
        roomId: 'deepseek',
        timestamp: 1000,
      })

      store.handleMessage({
        type: 'ai-chunk',
        id: 'msg-1',
        text: 'Partial',
        roomId: 'deepseek',
        timestamp: 1001,
      })

      store.handleMessage({
        type: 'ai-stop',
        id: 'msg-1',
        roomId: 'deepseek',
        timestamp: 1500,
      })

      expect(store.isAiGenerating).toBe(false)
      expect(store.currentMessages).toHaveLength(0)
    })
  })
})
