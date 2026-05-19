import type { InjectionKey, Ref, RenderFunction } from 'vue'

export interface LayoutSlotItem {
  name: string
  render: RenderFunction
}

export const NuxtLayoutSlotsSymbol: InjectionKey<Ref<LayoutSlotItem[]>> =
  Symbol('nuxt-layout-slots')

// 给页面用的 composable
export function useLayoutSlot(name: string, render: RenderFunction) {
  const slots = inject(NuxtLayoutSlotsSymbol)

  if (!slots) {
    console.warn('useLayoutSlot must be used inside app.vue with NuxtLayout')
    return
  }

  const item: LayoutSlotItem = { name, render }

  // 注册插槽（替换整个数组以触发 shallowRef 更新）
  slots.value = [...slots.value, item]

  // 页面卸载时自动清理
  onUnmounted(() => {
    slots.value = slots.value.filter((s) => s !== item)
  })
}
