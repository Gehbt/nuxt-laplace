import { describe, it, expect } from 'vitest'

import type { ChatMessage } from '../../app/types/chat'

import { buildAiContextMessages } from '../../server/utils/ai-context'

const AI_PEER_ID = 'ai:deepseek'

function msg(
  id: string,
  peerId: string,
  content: ChatMessage['content'],
  timestamp = 1000,
): ChatMessage {
  return { id, peerId, content, timestamp }
}

describe('buildAiContextMessages', () => {
  it('assistant message collapses its text parts to a plain string', () => {
    const history = [
      msg('1', AI_PEER_ID, [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ]),
    ]
    expect(buildAiContextMessages(history, AI_PEER_ID)).toEqual([
      { role: 'assistant', content: 'Hello world' },
    ])
  })

  it('single-text user message sends content as a plain string', () => {
    const history = [msg('1', 'user-1', [{ type: 'text', text: 'Hi there' }])]
    expect(buildAiContextMessages(history, AI_PEER_ID)).toEqual([
      { role: 'user', content: 'Hi there' },
    ])
  })

  it('mixed text + image user message keeps structured parts', () => {
    const history = [
      msg('1', 'user-1', [
        { type: 'text', text: 'Look:' },
        { type: 'image', url: '/uploads/cat.png' },
      ]),
    ]
    expect(buildAiContextMessages(history, AI_PEER_ID)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Look:' },
          { type: 'image', image: '/uploads/cat.png' },
        ],
      },
    ])
  })

  it('image-only user message sends an image part', () => {
    const history = [msg('1', 'user-1', [{ type: 'image', url: '/uploads/x.png' }])]
    expect(buildAiContextMessages(history, AI_PEER_ID)).toEqual([
      { role: 'user', content: [{ type: 'image', image: '/uploads/x.png' }] },
    ])
  })

  it('preserves chronological order across mixed roles', () => {
    const history = [
      msg('1', 'user-1', [{ type: 'text', text: 'Q' }], 1000),
      msg('2', AI_PEER_ID, [{ type: 'text', text: 'A' }], 2000),
      msg('3', 'user-1', [{ type: 'text', text: 'Follow up' }], 3000),
    ]
    expect(buildAiContextMessages(history, AI_PEER_ID)).toEqual([
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' },
      { role: 'user', content: 'Follow up' },
    ])
  })
})
