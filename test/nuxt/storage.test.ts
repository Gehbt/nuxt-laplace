import { describe, it, expect, beforeEach } from 'vitest'

import { sql } from '../../server/database/client'
import { getRooms, createRoom, getMessages, addMessage } from '../../server/utils/storage'

describe('chatStorage', () => {
  beforeEach(async () => {
    await sql`DELETE FROM chat.messages`
    await sql`DELETE FROM chat.rooms`
  })

  describe('rooms', () => {
    it('returns empty array when no rooms exist', async () => {
      const result = await getRooms()
      expect(result).toEqual([])
    })

    it('creates a room and retrieves it', async () => {
      const room = await createRoom('General')
      expect(room).toEqual({ id: 'general', name: 'General' })

      const result = await getRooms()
      expect(result).toEqual([{ id: 'general', name: 'General' }])
    })

    it('creates multiple rooms', async () => {
      await createRoom('General')
      await createRoom('Random Chat')

      const result = await getRooms()
      expect(result).toHaveLength(2)
      expect(result.find((r) => r.id === 'random-chat')).toBeDefined()
    })

    it('sluggifies room names', async () => {
      const room = await createRoom('My Cool Room!')
      expect(room.id).toBe('my-cool-room')
    })
  })

  describe('messages', () => {
    const roomId = 'general'

    beforeEach(async () => {
      await createRoom('General')
    })

    it('returns empty array when no messages exist', async () => {
      const result = await getMessages(roomId)
      expect(result).toEqual([])
    })

    it('adds a message and retrieves it', async () => {
      const msg = await addMessage(roomId, [{ type: 'text', text: 'Hello!' }], 'peer-1')
      expect(msg).toMatchObject({
        content: [{ type: 'text', text: 'Hello!' }],
        peerId: 'peer-1',
      })
      expect(msg.id).toBeDefined()
      expect(msg.timestamp).toBeGreaterThan(0)

      const result = await getMessages(roomId)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(msg)
    })

    it('returns messages sorted by timestamp', async () => {
      await addMessage(roomId, [{ type: 'text', text: 'First' }], 'peer-1')
      await addMessage(roomId, [{ type: 'text', text: 'Second' }], 'peer-2')

      const result = await getMessages(roomId)
      expect(result[0].content).toEqual([{ type: 'text', text: 'First' }])
      expect(result[1].content).toEqual([{ type: 'text', text: 'Second' }])
    })

    it('filters messages by before timestamp', async () => {
      await addMessage(roomId, [{ type: 'text', text: 'First' }], 'peer-1')
      await new Promise((r) => setTimeout(r, 5))
      const msg2 = await addMessage(roomId, [{ type: 'text', text: 'Second' }], 'peer-1')
      await new Promise((r) => setTimeout(r, 5))
      await addMessage(roomId, [{ type: 'text', text: 'Third' }], 'peer-1')

      const result = await getMessages(roomId, msg2.timestamp)
      expect(result).toHaveLength(1)
      expect(result[0].content).toEqual([{ type: 'text', text: 'First' }])
    })

    it('limits returned messages', async () => {
      for (let i = 0; i < 10; i++) {
        await addMessage(roomId, [{ type: 'text', text: `Msg ${i}` }], 'peer-1')
      }

      const result = await getMessages(roomId, undefined, 3)
      expect(result).toHaveLength(3)
    })
  })
})
