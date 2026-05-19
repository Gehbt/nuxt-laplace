<script setup lang="ts">
const props = defineProps<{
  peerId: string
}>()

const shortId = computed(() => props.peerId.slice(0, 8))
</script>

<template>
  <div v-if="peerId" class="text-sm text-gray-500 dark:text-gray-400 italic px-2">
    User {{ shortId }} is typing...
  </div>
</template>
