import type { UIMessage } from 'ai'
import type { H3Event } from 'h3'
import { streamText, convertToModelMessages } from 'ai'
import { getDeepSeekProvider } from '../utils/ai'

export default defineLazyEventHandler(async () => {
  const anthropic = getDeepSeekProvider()

  return defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
    const { messages }: { messages: UIMessage[] } = await readBody(event)

    const result = streamText({
      model: anthropic('deepseek-v4-pro'),
      system: 'You are a helpful assistant.',
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse()
  })
})
