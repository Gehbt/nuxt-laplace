import { readdir, readFile } from 'node:fs/promises'
import { db, sql } from '../server/database/client'
import { rooms, messages } from '../server/database/schema'
import type { Room } from '../app/types/chat'

async function migrate() {
  try {
    // Migrate rooms
    const roomsData = await readFile('./data/rooms', 'utf-8')
    const roomsArray: Room[] = JSON.parse(roomsData)
    if (roomsArray.length > 0) {
      await db.insert(rooms).values(roomsArray).onConflictDoNothing()
      console.log(`Migrated ${roomsArray.length} rooms`)
    }

    // Migrate messages
    const messageFiles = await readdir('./data/messages')
    let totalMessages = 0
    for (const file of messageFiles) {
      const content = await readFile(`./data/messages/${file}`, 'utf-8')
      const msgs = JSON.parse(content) as Array<{
        id: string
        content: string
        peerId: string
        timestamp: number
      }>
      if (msgs.length > 0) {
        await db.insert(messages).values(
          msgs.map((m) => ({
            id: m.id,
            content: m.content,
            peerId: m.peerId,
            timestamp: m.timestamp,
            roomId: file,
          })),
        )
        totalMessages += msgs.length
        console.log(`  Room "${file}": ${msgs.length} messages`)
      }
    }
    console.log(`Migrated ${totalMessages} total messages`)

    await sql.end()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
