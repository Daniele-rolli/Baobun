<script setup>
import { computed } from 'vue'

const props = defineProps({
  group: { type: Object, required: true },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})

const sizes = { sm: 'h-8 w-8 text-base', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-xl' }

const color = computed(() => props.group.color || '#4f46e5')
const initials = computed(() =>
  (props.group.name || '?')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
</script>

<template>
  <img
    v-if="group.imageUrl"
    :src="group.imageUrl"
    :alt="group.name"
    :class="[sizes[size], 'rounded-full object-cover flex-shrink-0']"
  />
  <span
    v-else-if="group.icon"
    :class="[sizes[size], 'flex items-center justify-center rounded-full flex-shrink-0']"
    role="img"
    :aria-label="`${group.name} emoji`"
  >
    {{ group.icon }}
  </span>
  <span
    v-else
    :class="[
      sizes[size],
      'flex items-center justify-center rounded-full flex-shrink-0 font-semibold',
    ]"
    :style="{ backgroundColor: `${color}26`, color }"
  >
    {{ initials }}
  </span>
</template>