import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createChatStorage } from '../../server/utils/storage'

describe('chatStorage', () => {
  let tempDir: string
  let storage: ReturnType<typeof createChatStorage>

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'chat-test-'))
    storage = createChatStorage(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  describe('rooms', () => {
    it('returns empty array when no rooms exist', async () => {
      const rooms = await storage.getRooms()
      expect(rooms).toEqual([])
    })

    it('creates a room and retrieves it', async () => {
      const room = await storage.createRoom('General')
      expect(room).toEqual({ id: 'general', name: 'General' })

      const rooms = await storage.getRooms()
      expect(rooms).toEqual([{ id: 'general', name: 'General' }])
    })

    it('creates multiple rooms', async () => {
      await storage.createRoom('General')
      await storage.createRoom('Random Chat')

      const rooms = await storage.getRooms()
      expect(rooms).toHaveLength(2)
      expect(rooms[1].id).toBe('random-chat')
    })

    it('sluggifies room names', async () => {
      const room = await storage.createRoom('My Cool Room!')
      expect(room.id).toBe('my-cool-room')
    })
  })

  describe('messages', () => {
    const roomId = 'general'

    it('returns empty array when no messages exist', async () => {
      const messages = await storage.getMessages(roomId)
      expect(messages).toEqual([])
    })

    it('adds a message and retrieves it', async () => {
      const msg = await storage.addMessage(roomId, 'Hello!', 'peer-1')
      expect(msg).toMatchObject({
        content: 'Hello!',
        peerId: 'peer-1',
      })
      expect(msg.id).toBeDefined()
      expect(msg.timestamp).toBeGreaterThan(0)

      const messages = await storage.getMessages(roomId)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(msg)
    })

    it('returns messages sorted by timestamp', async () => {
      await storage.addMessage(roomId, 'First', 'peer-1')
      await storage.addMessage(roomId, 'Second', 'peer-2')

      const messages = await storage.getMessages(roomId)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
    })

    it('filters messages by before timestamp', async () => {
      await storage.addMessage(roomId, 'First', 'peer-1')
      await new Promise((r) => setTimeout(r, 5))
      const msg2 = await storage.addMessage(roomId, 'Second', 'peer-1')
      await new Promise((r) => setTimeout(r, 5))
      await storage.addMessage(roomId, 'Third', 'peer-1')

      const messages = await storage.getMessages(roomId, msg2.timestamp)
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('First')
    })

    it('limits returned messages', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.addMessage(roomId, `Msg ${i}`, 'peer-1')
      }

      const messages = await storage.getMessages(roomId, undefined, 3)
      expect(messages).toHaveLength(3)
    })
  })
})
