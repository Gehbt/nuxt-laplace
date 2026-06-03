# AI Model Settings Popover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic AiModelSettings popover component next to the DeepSeek chat input, allowing users to adjust `thinkingType` and `reasoningEffort`, with values persisted to localStorage and forwarded to the API as `providerOptions`.

**Architecture:** A schema-driven Vue component (`AiModelSettings.vue`) renders a UPopover with USelect controls. The parent page (`[roomId].vue`) holds the persisted state via `useStorage` and passes it through `sendMessage` body to the server. The server route reads `providerOptions` from the body and forwards it to `streamText`.

**Tech Stack:** Vue 3, Nuxt UI (UPopover, USelect, UButton, UIcon), `@ai-sdk/vue` Chat class, `useStorage` composable.

---

## File Structure

| File                                      | Responsibility                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `app/components/chat/AiModelSettings.vue` | **New** — Generic popover that renders model option fields from a schema            |
| `app/pages/chat/[roomId].vue`             | **Modify** — Add settings state, schema, component, and pass options to sendMessage |
| `server/api/deepseek-chat.ts`             | **Modify** — Extract and forward `providerOptions` to `streamText`                  |

---

### Task 1: Create AiModelSettings component

**Files:**

- Create: `app/components/chat/AiModelSettings.vue`

- [ ] **Step 1: Create the AiModelSettings.vue component**

```vue
<script setup lang="ts">
export type AiModelSettingField = {
  key: string
  label: string
  type: 'select'
  options: { label: string; value: string }[]
}

const props = defineProps<{
  modelValue: Record<string, string>
  fields: AiModelSettingField[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

function onUpdate(key: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <UPopover>
    <UButton icon="i-lucide-settings-2" color="neutral" variant="ghost" size="sm" />

    <template #content>
      <div class="p-4 space-y-3 min-w-48">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Model Options
        </div>
        <div v-for="field in fields" :key="field.key" class="space-y-1">
          <label class="text-sm text-gray-700 dark:text-gray-300">{{ field.label }}</label>
          <USelect
            :model-value="modelValue[field.key]"
            :items="field.options"
            class="w-full"
            @update:model-value="(v: string) => onUpdate(field.key, v)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chat/AiModelSettings.vue
git commit -m "feat(chat): add AiModelSettings popover component"
```

---

### Task 2: Integrate AiModelSettings into DeepSeek room

**Files:**

- Modify: `app/pages/chat/[roomId].vue`

- [ ] **Step 1: Add settings state and field schema to the script block**

After the `aiInput` ref (line 24), add:

```ts
import type { AiModelSettingField } from '~/components/chat/AiModelSettings.vue'

const deepseekFields: AiModelSettingField[] = [
  {
    key: 'thinkingType',
    label: 'Thinking',
    type: 'select',
    options: [
      { label: 'Adaptive', value: 'adaptive' },
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' },
    ],
  },
  {
    key: 'reasoningEffort',
    label: 'Reasoning Effort',
    type: 'select',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' },
      { label: 'Max', value: 'max' },
    ],
  },
]

const deepseekOptions = useStorage('deepseek-model-options', {
  thinkingType: 'enabled',
  reasoningEffort: 'high',
})
```

- [ ] **Step 2: Modify aiSend to pass providerOptions**

Replace the `aiSend` function (lines 62-67) with:

```ts
function aiSend() {
  const text = aiInput.value.trim()
  if (!text || aiLoading.value) return
  aiChat.sendMessage(
    { text },
    {
      body: {
        providerOptions: {
          deepseek: {
            thinking: { type: deepseekOptions.value.thinkingType },
            reasoningEffort: deepseekOptions.value.reasoningEffort,
          },
        },
      },
    },
  )
  aiInput.value = ''
}
```

- [ ] **Step 3: Add AiModelSettings to the template input row**

Replace the DeepSeek input area (lines 139-154) with:

```html
<div class="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
  <UAvatar class="w-8 h-8" :src="userIcon" />
  <div class="w-1" />
  <UInput
    v-model="aiInput"
    :placeholder="aiLoading ? 'AI is thinking...' : 'Type a message...'"
    :disabled="aiLoading"
    class="flex-1"
    @keydown="aiHandleKeydown"
  />
  <AiModelSettings v-model="deepseekOptions" :fields="deepseekFields" />
  <UButton v-if="aiLoading" color="neutral" variant="subtle" @click="aiChat.stop()">
    <UIcon name="i-lucide-square" class="size-4" />
    Stop
  </UButton>
  <UButton v-else :disabled="!aiInput.trim()" @click="aiSend"> Send </UButton>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/pages/chat/[roomId].vue
git commit -m "feat(chat): integrate AiModelSettings into DeepSeek room"
```

---

### Task 3: Forward providerOptions in the server route

**Files:**

- Modify: `server/api/deepseek-chat.ts`

- [ ] **Step 1: Extract providerOptions from request body and pass to streamText**

Replace the full content of `server/api/deepseek-chat.ts` with:

```ts
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
    }: { messages: UIMessage[]; providerOptions?: Record<string, unknown> } = await readBody(event)

    const result = streamText({
      model: anthropic('deepseek-v4-pro'),
      system: 'You are a helpful assistant.',
      messages: await convertToModelMessages(messages),
      providerOptions,
    })

    return result.toUIMessageStreamResponse()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/deepseek-chat.ts
git commit -m "feat(chat): forward providerOptions to streamText in API route"
```

---

## Execution Order

1. Task 1 (AiModelSettings component) — frontend only, no side effects
2. Task 2 (integrate into page) — frontend, depends on Task 1
3. Task 3 (server route) — backend, independent of Tasks 1-2 but only effective after Task 2 sends the data
