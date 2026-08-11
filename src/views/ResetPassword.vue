<template>
  <div class="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Show error -->
      <div
        v-if="auth.error"
        class="bg-white dark:bg-neutral-900 shadow p-4 rounded-3xl flex gap-4 mb-2"
      >
        <p class="text-rose-600">{{ auth.error }}</p>
      </div>
      <div
        v-if="successMessage"
        class="bg-white dark:bg-neutral-900 shadow p-4 rounded-3xl flex gap-4 mb-2"
      >
        <party-popper />
        <p class="text-green-600 mb-3">{{ successMessage }}</p>
      </div>

      <form
        class="bg-white dark:bg-neutral-900 shadow p-4 rounded-3xl"
        @submit.prevent="handleSubmit"
        v-if="!successMessage"
      >
        <div class="flex justify-center mt-6">
          <div class="flex p-2 border w-fit rounded-lg justify-center items-center">
            <asterisk />
          </div>
        </div>
        <h1 class="text-center mt-6 text-2xl font-bold mb-4">Reset Password</h1>

        <!-- New Password -->
        <div class="mb-4 relative">
          <label class="block text-sm font-medium mb-1">New Password</label>
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            class="w-full border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-rose-600"
          />
          <button
            type="button"
            class="absolute right-2 top-9 text-sm text-gray-600"
            @click="showPassword = !showPassword"
          >
            <Eye v-if="!showPassword" class="w-5 h-5" />
            <eye-closed v-else class="w-5 h-5" />
          </button>
        </div>

        <!-- Confirm Password -->
        <div class="mb-4 relative">
          <label class="block text-sm font-medium mb-1">Confirm Password</label>
          <input
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            required
            class="w-full border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-rose-600"
          />
          <button
            type="button"
            class="absolute right-2 top-9 text-sm text-gray-600"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <Eye v-if="!showConfirmPassword" class="w-5 h-5" />
            <eye-closed v-else class="w-5 h-5" />
          </button>
        </div>

        <button
          type="submit"
          class="w-full bg-rose-600 text-white py-2 rounded-lg disabled:opacity-50"
          :disabled="auth.loading"
        >
          Reset Password
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Unlink, PartyPopper, Asterisk, Eye, EyeClosed } from 'lucide-vue-next'

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

onMounted(() => {
  userId.value = route.query.userId
  secret.value = route.query.secret

  if (!userId.value || !secret.value) {
    auth.error = 'Invalid or expired reset link.'
  }
})

const handleSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    auth.error = 'Passwords do not match.'
    return
  }

  const result = await auth.confirmResetPassword(
    userId.value,
    secret.value,
    password.value,
    confirmPassword.value,
  )

  if (result.success) {
    successMessage.value = 'Your password has been reset successfully.'
    setTimeout(() => router.push('/login'), 2000)
  }
}
</script>
