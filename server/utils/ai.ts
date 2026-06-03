import type { DeepSeekProvider } from '@ai-sdk/deepseek'

import { createDeepSeek } from '@ai-sdk/deepseek'

export function getDeepSeekProvider(): DeepSeekProvider {
  const { deepseekApiKey, deepseekBaseUrl } = useRuntimeConfig()

  if (!deepseekApiKey)
    throw new Error('getDeepSeekProvider Fail', { cause: 'Missing DEEPSEEK_API_KEY' })

  return createDeepSeek({
    baseURL: deepseekBaseUrl || undefined,
    apiKey: deepseekApiKey,
  })
}
