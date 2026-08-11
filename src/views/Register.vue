<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-12 bg-neutral-50 dark:bg-neutral-900">
    <div class="w-full max-w-sm space-y-4">

      <!-- Error banner -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div
          v-if="authStore.error"
          class="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm"
        >
          <HeartCrack class="w-4 h-4 flex-shrink-0" />
          {{ authStore.error }}
        </div>
      </transition>

      <!-- Card -->
      <div class="card p-6 sm:p-8">
        <div class="text-center mb-8">
          <img class="h-16 w-auto mx-auto mb-4" src="../../public/baobun.png" alt="Baobun" />
          <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">Create account</h1>
          <p class="text-sm text-neutral-500 mt-1">Join and start organizing together</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div class="space-y-1.5">
            <UiLabel for="name">Full Name</UiLabel>
            <UiInput id="name" v-model="name" type="text" required placeholder="Jane Smith" />
          </div>
          <div class="space-y-1.5">
            <UiLabel for="email">Email</UiLabel>
            <UiInput id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@example.com" />
          </div>
          <div class="space-y-1.5">
            <UiLabel for="password">Password</UiLabel>
            <UiInput id="password" v-model="password" type="password" autocomplete="new-password" required placeholder="••••••••" />
          </div>
          <div class="space-y-1.5">
            <UiLabel for="confirm-password">Confirm Password</UiLabel>
            <UiInput id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" required placeholder="••••••••" />
          </div>

          <div class="pt-1">
            <button type="submit" :disabled="authStore.loading" class="btn-primary w-full">
              <svg v-if="authStore.loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ authStore.loading ? 'Creating account…' : 'Register' }}
            </button>
          </div>
        </form>
      </div>

      <p class="text-center text-sm text-neutral-500">
        Already have an account?
        <router-link to="/login" class="ml-1 font-medium text-rose-600 hover:text-rose-700">Sign in</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { HeartCrack } from 'lucide-vue-next'

export default {
  components: { HeartCrack },
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    const name = ref('')
    const email = ref('')
    const password = ref('')
    const confirmPassword = ref('')

    const handleRegister = async () => {
      if (password.value !== confirmPassword.value) { authStore.error = 'Passwords do not match'; return }
      await authStore.register(name.value, email.value, password.value)
      if (authStore.user) {
        const pending = sessionStorage.getItem('pendingInviteCode')
        if (pending) { sessionStorage.removeItem('pendingInviteCode'); router.push(`/join/${pending}`) }
        else router.push('/dashboard')
      }
    }

    return { authStore, name, email, password, confirmPassword, handleRegister }
  },
}
</script>
