<template>
  <div class="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <!-- Forgot Password Form -->
      <form
        v-if="!successMessage"
        @submit.prevent="handleSubmit"
        class="bg-white dark:bg-neutral-900 shadow p-6 rounded-3xl space-y-6"
      >
        <div class="flex justify-center">
          <div class="flex p-3 border rounded-lg justify-center items-center">
            <KeyRound class="w-6 h-6" />
          </div>
        </div>

        <h2 class="text-center text-2xl font-bold">Forgot Password</h2>
        <p class="text-center text-sm text-neutral-600 dark:text-neutral-400">
          You'll receive a password reset link on the email you used to register your Baobun
          account.
        </p>

        <div class="space-y-1.5">
          <UiLabel for="email">Email</UiLabel>
          <UiInput
            id="email"
            v-model="email"
            type="email"
            autocomplete="on"
            required
            placeholder="you@example.com"
          />
        </div>

        <div class="flex gap-2">
          <router-link
            to="/login"
            class="w-full flex items-center justify-center gap-2 bg-white dark:bg-neutral-900 text-neutral border py-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/20 transition disabled:opacity-50"
          >
            <ChevronLeft class="w-5 h-5" />
            <span>Back to login</span>
          </router-link>

          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 bg-rose-600 text-white py-2 rounded-xl hover:bg-rose-700 transition disabled:opacity-50"
            :disabled="auth.loading"
          >
            <span>Reset Password</span>
            <ChevronRight class="w-5 h-5" />
          </button>
        </div>
      </form>

      <!-- Error State -->
      <div
        v-if="auth.error"
        class="mt-4 flex gap-3 bg-rose-100/10 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm"
      >
        <HeartCrack class="w-5 h-5" />
        <p class="text-red-600">Something went wrong. Please try again.</p>
      </div>

      <!-- Success State -->
      <div
        v-if="successMessage"
        class="bg-white dark:bg-neutral-900 shadow p-6 rounded-3xl space-y-6"
      >
        <div class="flex justify-center">
          <div class="flex p-3 border rounded-lg justify-center items-center">
            <Mail class="w-6 h-6" />
          </div>
        </div>

        <h2 class="text-center text-2xl font-bold">Email Sent</h2>
        <p class="text-center text-sm text-neutral-600 dark:text-neutral-400">
          We have sent an email to <span class="text-rose-500 font-medium">{{ email }}</span
          >. Check your inbox and follow the instructions to reset your password.
        </p>

        <button
          @click="handleSubmit"
          type="button"
          class="w-full flex items-center justify-center gap-2 bg-rose-600 text-white py-2 rounded-xl hover:bg-rose-700 transition disabled:opacity-50"
          :disabled="auth.loading"
        >
          <span>Send Again</span>
        </button>
      </div>
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
