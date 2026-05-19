export interface ChatMessage {
  id: string
  content: string
  peerId: string
  timestamp: number
}

export interface Room {
  id: string
  name: string
}

export type ClientMessage =
  | { type: 'join'; roomId: string }
  | { type: 'chat'; content: string }
  | { type: 'typing' }
  | { type: 'history'; roomId: string; before?: number; limit?: number }
  | { type: 'create-room'; name: string }

export type ServerMessage =
  | { type: 'welcome'; peerId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'typing'; peerId: string }
  | { type: 'user-joined'; peerId: string; onlineUsers: string[] }
  | { type: 'user-left'; peerId: string; onlineUsers: string[] }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'room-created'; room: Room }
  | { type: 'rooms'; rooms: Room[] }
  | { type: 'online-count'; count: number }
