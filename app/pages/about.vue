<script lang="ts" setup>
import { useLayoutSlot } from '~/composables/useLayoutSlots'

const headerSlot = useTemplateRef('headerSlot')
useLayoutSlot('header', () => (headerSlot.value ? [h(headerSlot.value)] : []))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-lone-template -->
  <template ref="headerSlot">
    <div>这是首页特有的 Header</div>
  </template>
  <!-- eslint-disable-next-line vue/no-multiple-template-root -->
  <div>首页内容</div>
</template>

<!-- <layout-slot name="header">
  {{ headerSlot.value }}
</layout-slot> -->
