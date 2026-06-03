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
