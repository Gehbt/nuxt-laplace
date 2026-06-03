import { relations } from 'drizzle-orm'
import { bigint, pgSchema, text, uuid, varchar } from 'drizzle-orm/pg-core'

const chatSchema = pgSchema('chat')

export const rooms = chatSchema.table('rooms', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
})

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
}))

export const messages = chatSchema.table('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  peerId: varchar('peer_id').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  roomId: varchar('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
})

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
}))
