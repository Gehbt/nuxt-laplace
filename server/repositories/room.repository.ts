import { eq } from 'drizzle-orm'

import type { Room } from '../../app/types/chat'

import { db } from '../database/client'
import { rooms } from '../database/schema'

export class RoomRepository {
  async findAll(): Promise<Room[]> {
    return db.select().from(rooms)
  }

  async create(name: string): Promise<Room> {
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const [room] = await db.insert(rooms).values({ id, name }).returning()
    return room!
  }

  async exists(id: string): Promise<boolean> {
    const [row] = await db.select().from(rooms).where(eq(rooms.id, id))
    return !!row
  }
}
