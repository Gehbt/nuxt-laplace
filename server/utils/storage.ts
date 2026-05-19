import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import type { ChatMessage, Room } from '../../app/types/chat'

export function createChatStorage(basePath = './data') {
  const storage = createStorage({
    driver: fsDriver({ base: basePath }),
  })

  async function getRooms(): Promise<Room[]> {
    return (await storage.getItem<Room[]>('rooms')) || []
  }

  async function createRoom(name: string): Promise<Room> {
    const rooms = await getRooms()
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const room: Room = { id, name }
    await storage.setItem('rooms', [...rooms, room])
    return room
  }

  async function getMessages(roomId: string, before?: number, limit = 50): Promise<ChatMessage[]> {
    const messages = (await storage.getItem<ChatMessage[]>(`messages/${roomId}`)) || []
    let result = [...messages]
    if (before) {
      result = result.filter((m) => m.timestamp < before)
    }
    result.sort((a, b) => a.timestamp - b.timestamp)
    return result.slice(-limit)
  }

  async function addMessage(roomId: string, content: string, peerId: string): Promise<ChatMessage> {
    const messages = (await storage.getItem<ChatMessage[]>(`messages/${roomId}`)) || []
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      peerId,
      timestamp: Date.now(),
    }
    messages.push(message)
    await storage.setItem(`messages/${roomId}`, messages)
    return message
  }

  return { storage, getRooms, createRoom, getMessages, addMessage }
}

export const { getRooms, createRoom, getMessages, addMessage } = createChatStorage()
