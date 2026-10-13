<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, required: false },
  size: { type: String, required: false, default: 'default' },
})
</script>

<template>
  <div
    data-slot="card"
    :data-size="size"
    :class="
      cn(
        'bg-card text-card-foreground border-border gap-6 overflow-hidden rounded-3xl border text-sm shadow-md has-[>img:first-child]:pt-0 data-[size=sm]:gap-4 *:[img:first-child]:rounded-t-3xl *:[img:last-child]:rounded-b-3xl group/card flex flex-col',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
