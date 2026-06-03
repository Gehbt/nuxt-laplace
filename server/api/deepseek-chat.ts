import type { UIMessage } from 'ai'
import type { H3Event } from 'h3'

import { streamText, convertToModelMessages } from 'ai'

import { getDeepSeekProvider } from '../utils/ai'

export default defineLazyEventHandler(async () => {
  const anthropic = getDeepSeekProvider()

  return defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
    const {
      messages,
      providerOptions,
    }: { messages: UIMessage[]; providerOptions?: Record<string, Record<string, unknown>> } =
      await readBody(event)

    const result = streamText({
      model: anthropic('deepseek-v4-pro'),
      system: 'You are a helpful assistant.',
      messages: await convertToModelMessages(messages),
      providerOptions: providerOptions as Parameters<typeof streamText>[0]['providerOptions'],
    })

    return result.toUIMessageStreamResponse()
  })
})
