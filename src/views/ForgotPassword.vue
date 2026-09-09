<template>
  <div class="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Forgot Password Form -->
      <UiCard v-if="!successMessage" class="rounded-3xl">
        <UiCardContent class="p-6">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div class="flex justify-center">
              <div class="flex items-center justify-center rounded-xl border bg-muted/40 p-3">
                <KeyRound class="h-6 w-6 text-primary" />
              </div>
            </div>

            <div class="space-y-2">
              <h1 class="text-center text-2xl font-bold">Forgot your password?</h1>
              <p class="text-center text-sm text-muted-foreground">
                Enter your account email and we’ll send you a secure reset link.
              </p>
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

            <div
              v-if="auth.error"
              role="alert"
              class="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <HeartCrack class="h-5 w-5 shrink-0" />
              <p>{{ auth.error }}</p>
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <UiButton as-child variant="outline">
                <router-link to="/login">
                  <ChevronLeft class="h-4 w-4" />
                  Back to login
                </router-link>
              </UiButton>

              <UiButton type="submit" :disabled="auth.loading">
                {{ auth.loading ? 'Sending…' : 'Send reset link' }}
                <ChevronRight class="h-4 w-4" />
              </UiButton>
            </div>
          </form>
        </UiCardContent>
      </UiCard>

      <UiCard v-else class="rounded-3xl">
        <UiCardContent class="space-y-6 p-6">
          <div class="flex justify-center">
            <div class="flex items-center justify-center rounded-xl border bg-muted/40 p-3">
              <Mail class="h-6 w-6 text-primary" />
            </div>
          </div>
          <div class="space-y-2 text-center">
            <h1 class="text-2xl font-bold">Check your email</h1>
            <p class="text-sm text-muted-foreground">
              If an account exists for <span class="font-medium text-foreground">{{ email }}</span
              >, a reset link is on its way.
            </p>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <UiButton as-child variant="outline">
              <router-link to="/login">Back to login</router-link>
            </UiButton>
            <UiButton type="button" :disabled="auth.loading" @click="handleSubmit">
              {{ auth.loading ? 'Sending…' : 'Send again' }}
            </UiButton>
          </div>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { KeyRound, ChevronLeft, ChevronRight, HeartCrack, Mail } from 'lucide-vue-next'

const auth = useAuthStore()
const email = ref('')
const successMessage = ref('')

const handleSubmit = async () => {
  const result = await auth.resetPassword(email.value)

  if (result.success) {
    successMessage.value =
      'If this email exists in our system, you’ll receive a reset link shortly.'
  }
}
</script>
