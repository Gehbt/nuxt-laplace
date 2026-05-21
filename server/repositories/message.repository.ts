import { db } from '../database/client'
import { messages } from '../database/schema'
import { and, asc, eq, lt } from 'drizzle-orm'
import type { ChatMessage } from '../../app/types/chat'

export class MessageRepository {
  async findByRoom(roomId: string, before?: number, limit = 50): Promise<ChatMessage[]> {
    const conditions = [eq(messages.roomId, roomId)]
    if (before) {
      conditions.push(lt(messages.timestamp, before))
    }

    return db
      .select()
      .from(messages)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(messages.timestamp))
      .limit(limit)
  }

  async create(roomId: string, content: string, peerId: string): Promise<ChatMessage> {
    const [message] = await db
      .insert(messages)
      .values({ roomId, content, peerId, timestamp: Date.now() })
      .returning()
    return message!
  }
}
