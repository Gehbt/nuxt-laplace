import type { ChatMessage, MessagePart, Room } from '../../app/types/chat'

import { MessageRepository } from '../repositories/message.repository'
import { RoomRepository } from '../repositories/room.repository'

const roomRepo = new RoomRepository()
const messageRepo = new MessageRepository()

export async function getRooms(): Promise<Room[]> {
  return roomRepo.findAll()
}

export async function createRoom(name: string): Promise<Room> {
  return roomRepo.create(name)
}

export async function getMessages(
  roomId: string,
  before?: number,
  limit?: number,
): Promise<ChatMessage[]> {
  return messageRepo.findByRoom(roomId, before, limit)
}

export async function addMessage(
  roomId: string,
  content: MessagePart[],
  peerId: string,
): Promise<ChatMessage> {
  return messageRepo.create(roomId, content, peerId)
}
