<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    aria-live="polite"
    aria-relevant="additions"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in store.items"
        :key="toast.id"
        role="status"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-background p-4 text-foreground shadow-lg"
        :class="
          toast.variant === 'destructive'
            ? 'border-destructive/40'
            : toast.variant === 'success'
              ? 'border-emerald-500/40'
              : ''
        "
      >
        <CircleCheck
          v-if="toast.variant === 'success'"
          class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
        />
        <CircleAlert
          v-else-if="toast.variant === 'destructive'"
          class="mt-0.5 h-5 w-5 shrink-0 text-destructive"
        />
        <Info v-else class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">{{ toast.title }}</p>
          <p v-if="toast.description" class="mt-1 text-sm text-muted-foreground">
            {{ toast.description }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
          @click="store.dismiss(toast.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast'

const store = useToastStore()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
