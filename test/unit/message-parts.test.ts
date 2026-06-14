import { describe, it, expect } from 'vitest'

import type { MessagePart } from '../../app/types/chat'

describe('MessagePart', () => {
  it('builds a text part', () => {
    const part: MessagePart = { type: 'text', text: 'Hello' }
    expect(part.type).toBe('text')
    expect(part.text).toBe('Hello')
  })

  it('builds an image part', () => {
    const part: MessagePart = { type: 'image', url: '/uploads/test.png' }
    expect(part.type).toBe('image')
    expect(part.url).toBe('/uploads/test.png')
  })

  it('mixes text and image parts in a content array', () => {
    const content: MessagePart[] = [
      { type: 'text', text: 'Look at this:' },
      { type: 'image', url: '/uploads/cat.png' },
    ]
    expect(content).toHaveLength(2)
    expect(content[0].type).toBe('text')
    expect(content[1].type).toBe('image')
  })

  it('narrows part type to access type-specific fields', () => {
    const part: MessagePart = { type: 'text', text: 'Hi' }
    if (part.type === 'text') {
      expect(part.text).toBe('Hi')
    }
  })
})
