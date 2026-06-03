# AI Model Settings Popover — Design Spec

## Goal

Add a configurable settings popover next to the chat input in AI chat rooms. Starts with DeepSeek (`thinkingType`, `reasoningEffort`), but the component is generic and reusable for future AI model rooms.

## Data Flow

```
AiModelSettings (Popover)
  → useStorage('deepseek-model-options', defaults)
  → [roomId].vue reads options ref
  → aiChat.sendMessage({ text }, { body: { providerOptions: { deepseek: options } } })
  → server/api/deepseek-chat.ts reads body.providerOptions
  → streamText({ ..., providerOptions })
```

## Components

### AiModelSettings.vue (new)

**Path:** `app/components/chat/AiModelSettings.vue`

Generic popover settings component driven by a field schema.

**Props:**

- `modelValue: Record<string, any>` — current option values (v-model)
- `fields: AiModelSettingField[]` — field schema array

**AiModelSettingField type:**

```ts
type AiModelSettingField = {
  key: string // field name in providerOptions
  label: string // UI display name
  type: 'select' // currently only select; extensible later
  options: { label: string; value: string }[]
  defaultValue: string
}
```

**UI:** Gear icon button → UPopover → one USelect per field.

**Emit:** `update:modelValue` for two-way binding.

### [roomId].vue changes

Add `useStorage` for persistent settings:

```ts
const deepseekOptions = useStorage('deepseek-model-options', {
  thinkingType: 'enabled',
  reasoningEffort: 'high',
})
```

Define DeepSeek field schema:

```ts
const deepseekFields = [
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
```

Add `<AiModelSettings>` next to the input row (line ~139 area), between the input and Send/Stop button.

Modify `aiSend()`:

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

### server/api/deepseek-chat.ts changes

Extract `providerOptions` from request body and forward to `streamText`:

```ts
const { messages, providerOptions } = await readBody(event)
// ...
streamText({
  // ...
  providerOptions,
})
```

## Files Changed

| File                                      | Change                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `app/components/chat/AiModelSettings.vue` | New — generic popover settings component                     |
| `app/pages/chat/[roomId].vue`             | Add useStorage, field schema, AiModelSettings, modify aiSend |
| `server/api/deepseek-chat.ts`             | Read providerOptions from body, pass to streamText           |

## Extensibility

When adding a new AI room (e.g., GPT, Claude):

1. Define a new field schema and useStorage key for that model.
2. Reuse `<AiModelSettings>` with the new schema.
3. Pass model-specific providerOptions through sendMessage body.
