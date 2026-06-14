import { relations } from 'drizzle-orm'
import { bigint, index, jsonb, pgSchema, uuid, varchar } from 'drizzle-orm/pg-core'

import type { MessagePart } from '../../app/types/chat'

const chatSchema = pgSchema('chat')

export const rooms = chatSchema.table('rooms', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
})

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
}))

export const messages = chatSchema.table(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: jsonb('content').notNull().$type<MessagePart[]>(),
    peerId: varchar('peer_id').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    roomId: varchar('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
  },
  (table) => [index('messages_room_timestamp_idx').on(table.roomId, table.timestamp)],
)

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
}))
