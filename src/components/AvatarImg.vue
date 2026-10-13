<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="name"
    class="shrink-0 object-cover"
    :class="cn($attrs.class)"
    @error="failed = true"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center bg-muted text-muted-foreground"
    :class="cn($attrs.class)"
    aria-hidden="true"
  >
    <User class="h-[55%] w-[55%]" />
  </span>
</template>

<script setup>
import { ref } from 'vue'
import { User } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const failed = ref(false)
defineOptions({ inheritAttrs: false })

defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
})
</script>