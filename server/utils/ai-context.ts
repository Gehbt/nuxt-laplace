import type { ChatMessage, MessagePart } from '../../app/types/chat'

type AiContentPart = { type: 'text'; text: string } | { type: 'image'; image: string }

export type AiContextMessage =
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: string | AiContentPart[] }

/**
 * Convert stored chat history (MessagePart[] content) into the message shape
 * expected by the AI SDK's streamText. Assistant messages collapse to plain
 * text; user messages keep their multimodal parts, with a single text part
 * simplified to a plain string for the model.
 */
export function buildAiContextMessages(
  history: ChatMessage[],
  aiPeerId: string,
): AiContextMessage[] {
  return history.map((msg) => {
    if (msg.peerId === aiPeerId) {
      const text = msg.content
        .filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('')
      return { role: 'assistant', content: text }
    }

    const parts: AiContentPart[] = msg.content.map((part) => {
      if (part.type === 'image') {
        return { type: 'image', image: part.url }
      }
      return { type: 'text', text: part.text }
    })

    // Single text part: send as plain string (simpler for the model)
    if (parts.length === 1) {
      const single = parts[0]!
      if (single.type === 'text') {
        return { role: 'user', content: single.text }
      }
    }

    return { role: 'user', content: parts }
  })
}
