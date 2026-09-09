<template>
  <div class="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <UiCard class="rounded-3xl">
        <UiCardContent class="p-6">
          <div v-if="successMessage" class="space-y-6 text-center">
            <div class="flex justify-center">
              <div class="rounded-xl border bg-emerald-500/10 p-3 text-emerald-600">
                <PartyPopper class="h-6 w-6" />
              </div>
            </div>
            <div class="space-y-2">
              <h1 class="text-2xl font-bold">Password updated</h1>
              <p class="text-sm text-muted-foreground">{{ successMessage }}</p>
            </div>
            <UiButton class="w-full" @click="router.push('/login')">Continue to login</UiButton>
          </div>

          <form v-else class="space-y-6" @submit.prevent="handleSubmit">
            <div class="flex justify-center">
              <div class="rounded-xl border bg-muted/40 p-3">
                <Asterisk class="h-6 w-6 text-primary" />
              </div>
            </div>
            <div class="space-y-2 text-center">
              <h1 class="text-2xl font-bold">Choose a new password</h1>
              <p class="text-sm text-muted-foreground">Use at least eight characters.</p>
            </div>

            <div class="space-y-1.5">
              <UiLabel for="new-password">New password</UiLabel>
              <div class="relative">
                <UiInput
                  id="new-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="8"
                  class="pr-10"
                  required
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="h-4 w-4" />
                  <EyeClosed v-else class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <UiLabel for="confirm-password">Confirm password</UiLabel>
              <div class="relative">
                <UiInput
                  id="confirm-password"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="8"
                  class="pr-10"
                  required
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <Eye v-if="!showConfirmPassword" class="h-4 w-4" />
                  <EyeClosed v-else class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              v-if="auth.error"
              role="alert"
              class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {{ auth.error }}
            </div>

            <UiButton type="submit" class="w-full" :disabled="auth.loading || !hasValidLink">
              {{ auth.loading ? 'Updating…' : 'Update password' }}
            </UiButton>
          </form>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { PartyPopper, Asterisk, Eye, EyeClosed } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const confirmPassword = ref('')
const userId = ref(null)
const secret = ref(null)
const successMessage = ref('')

// Toggle states for show/hide
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const hasValidLink = computed(() => Boolean(userId.value && secret.value))

onMounted(() => {
  userId.value = route.query.userId
  secret.value = route.query.token || route.query.secret

  if (!userId.value || !secret.value) {
    auth.error = 'Invalid or expired reset link.'
  }
})

const handleSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    auth.error = 'Passwords do not match.'
    return
  }

  const result = await auth.confirmResetPassword(userId.value, secret.value, password.value)

  if (result.success) {
    successMessage.value = 'Your password has been reset successfully.'
    setTimeout(() => router.push('/login'), 2000)
  }
}
</script>
