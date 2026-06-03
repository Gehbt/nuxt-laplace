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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'chat'; content: string; llmOptions?: Record<string, any> }
  | { type: 'typing' }
  | { type: 'history'; roomId: string; before?: number; limit?: number }
  | { type: 'create-room'; name: string }
  | { type: 'stop-ai' }

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
  | { type: 'room-left'; roomId: string; peerId: string }
  | { type: 'ai-start'; id: string; peerId: 'ai:deepseek'; roomId: string; timestamp: number }
  | { type: 'ai-chunk'; id: string; text: string; roomId: string; timestamp: number }
  | { type: 'ai-end'; id: string; roomId: string; timestamp: number }
  | { type: 'ai-stop'; id: string; roomId: string; timestamp: number }
