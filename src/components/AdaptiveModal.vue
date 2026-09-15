<script setup>
import { useMediaQuery } from '@vueuse/core'

defineProps({
  open: { type: Boolean, default: false },
  dialogClass: { type: String, default: '' },
})

defineEmits(['update:open'])

const isMobile = useMediaQuery('(max-width: 640px)')
</script>

<template>
  <UiDrawer
    v-if="isMobile"
    :open="open"
    swipe-direction="down"
    @update:open="$emit('update:open', $event)"
  >
    <UiDrawerContent class="max-h-[90vh]">
      <UiDrawerHeader v-if="$slots.title">
        <UiDrawerTitle><slot name="title" /></UiDrawerTitle>
      </UiDrawerHeader>
      <div
        class="overflow-y-auto overscroll-contain"
        :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
      >
        <slot />
      </div>
      <UiDrawerFooter v-if="$slots.footer">
        <slot name="footer" />
      </UiDrawerFooter>
    </UiDrawerContent>
  </UiDrawer>
  <UiDialog v-else :open="open" @update:open="$emit('update:open', $event)">
    <UiDialogContent :class="dialogClass">
      <UiDialogHeader v-if="$slots.title">
        <UiDialogTitle><slot name="title" /></UiDialogTitle>
      </UiDialogHeader>
      <slot />
      <UiDialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
