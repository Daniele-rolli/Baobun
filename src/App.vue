<template>
  <div
    class="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
  >
    <div v-if="isAuthRoute" class="min-h-screen w-full flex items-center justify-center p-4">
      <router-view />
    </div>

    <div v-else class="relative min-h-screen">
      <Navigator
        v-if="isLoggedIn"
        :collapsed="isCollapsed"
        @toggle="isCollapsed = !isCollapsed"
        class="fixed left-0 top-0 bottom-0 z-50"
      />

      <main
        class="transition-all duration-300 min-h-screen flex flex-col"
        :class="[isLoggedIn ? (isCollapsed ? 'md:ml-24' : 'md:ml-72') : 'ml-0']"
      >
        <div class="flex-1 p-4 pb-24 md:p-8">
          <router-view v-slot="{ Component, route }">
            <transition name="page" mode="out-in">
              <component :is="Component" :key="route.path" />
            </transition>
          </router-view>
        </div>

        <footer class="p-4 pb-24 text-center text-xs text-muted-foreground md:pb-4">
          &copy; {{ currentYear }} Baobun
        </footer>
      </main>
    </div>
    <ToastViewport />
  </div>
</template>

<script>
import Navigator from '@/components/Home/Navigator.vue'
import ToastViewport from '@/components/ToastViewport.vue'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'App',
  components: {
    Navigator,
    ToastViewport,
  },
  data() {
    return {
      isCollapsed: false,
      theme: 'system',
    }
  },
  computed: {
    isLoggedIn() {
      const authStore = useAuthStore()
      return authStore.isLoggedIn
    },
    isAuthRoute() {
      const authPaths = ['/login', '/register', '/forgot-password', '/reset-password']
      return authPaths.includes(this.$route.path)
    },
    currentYear() {
      return new Date().getFullYear()
    },
  },
  watch: {
    theme(newTheme) {
      localStorage.setItem('theme', newTheme)
      this.applyTheme(newTheme)
    },
  },
  mounted() {
    this.theme = localStorage.getItem('theme') || 'system'
    this.applyTheme(this.theme)
  },
  methods: {
    applyTheme(theme) {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
    },
  },
}
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
