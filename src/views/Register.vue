<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-12">
    <div class="w-full max-w-sm space-y-4">
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div
          v-if="authStore.error"
          role="alert"
          class="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <HeartCrack class="h-5 w-5 shrink-0" />
          <p>{{ authStore.error }}</p>
        </div>
      </transition>

      <UiCard>
        <UiCardHeader class="items-center text-center">
          <img
            class="mb-2 h-16 w-16"
            src="/icons/icon_128x128.png"
            alt="Baobun"
            width="64"
            height="64"
          />
          <UiCardTitle class="text-2xl">Create account</UiCardTitle>
          <UiCardDescription>Join and start organizing together</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <form @submit.prevent="handleRegister" class="space-y-4">
            <div class="space-y-1.5">
              <UiLabel for="name">Full Name</UiLabel>
              <UiInput id="name" v-model="name" type="text" required placeholder="Jane Smith" />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="email">Email</UiLabel>
              <UiInput
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="password">Password</UiLabel>
              <UiInput
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                required
                placeholder="••••••••"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="confirm-password">Confirm Password</UiLabel>
              <UiInput
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                placeholder="••••••••"
              />
            </div>

            <UiButton type="submit" :disabled="authStore.loading" class="w-full">
              <LoaderCircle v-if="authStore.loading" class="h-4 w-4 animate-spin" />
              {{ authStore.loading ? 'Creating account…' : 'Register' }}
            </UiButton>
          </form>
        </UiCardContent>
      </UiCard>

      <p class="text-center text-sm text-muted-foreground">
        Already have an account?
        <router-link to="/login" class="ml-1 font-medium text-primary hover:underline">
          Sign in
        </router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { HeartCrack, LoaderCircle } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    authStore.error = 'Passwords do not match'
    return
  }
  await authStore.register(name.value, email.value, password.value)
  if (authStore.user) {
    const pending = sessionStorage.getItem('pendingInviteCode')
    if (pending) {
      sessionStorage.removeItem('pendingInviteCode')
      router.push(`/join/${pending}`)
    } else router.push('/dashboard')
  }
}
</script>
