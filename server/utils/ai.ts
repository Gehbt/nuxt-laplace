import { createAnthropic } from '@ai-sdk/anthropic'

export function getDeepSeekProvider() {
  const { deepseekApiKey, deepseekBaseUrl } = useRuntimeConfig()

  if (!deepseekApiKey) throw new Error('Missing DEEPSEEK_API_KEY')

  return createAnthropic({
    baseURL: deepseekBaseUrl || undefined,
    apiKey: deepseekApiKey,
  })
}
