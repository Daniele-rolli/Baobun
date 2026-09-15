<template>
  <div class="min-h-screen bg-background text-foreground">
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
        <div class="p-4 md:p-8 flex-1">
          <router-view v-slot="{ Component, route }">
            <transition name="page" mode="out-in">
              <component :is="Component" :key="route.path" />
            </transition>
          </router-view>
        </div>

        <footer class="p-4 text-center text-xs text-muted-foreground">&copy; 2026 Baobun</footer>
      </main>

      <ToastViewport />
      <UiDialog v-model:open="installOpen">
        <UiDialogContent class="sm:max-w-md">
          <UiDialogHeader>
            <UiDialogTitle class="flex items-center gap-2">
              <Download class="w-5 h-5" />
              <span class="text-lg font-semibold">Install App</span>
            </UiDialogTitle>
          </UiDialogHeader>

          <div class="space-y-6">
            <div v-if="platform === 'android'">
              <div class="flex items-center gap-2 mb-3">
                <Smartphone class="w-6 h-6 text-green-600" />
                <h3 class="font-semibold text-lg">Android (Chrome)</h3>
              </div>
              <ol class="space-y-3 text-base">
                <li class="flex items-center gap-3">
                  <Share class="w-5 h-5 text-green-600" /> 1. Tap the <b>Share</b> icon
                </li>
                <li class="flex items-center gap-3">
                  <Box class="w-5 h-5 text-green-600" /> 2. Select <b>Add to Home Screen</b>
                </li>
                <li class="flex items-center gap-3">
                  <CheckCircle class="w-5 h-5 text-green-600" /> 3. Confirm install
                </li>
              </ol>
            </div>

            <div v-else-if="platform === 'ios'">
              <div class="flex items-center gap-2 mb-3">
                <Smartphone class="w-6 h-6 text-blue-600" />
                <h3 class="font-semibold text-lg">iOS (Safari)</h3>
              </div>
              <ol class="space-y-3 text-base">
                <li class="flex items-center gap-3">
                  <Share class="w-5 h-5 text-blue-600" /> 1. Tap the <b>Share</b> icon
                </li>
                <li class="flex items-center gap-3">
                  <PlusSquare class="w-5 h-5 text-blue-600" /> 2. Choose <b>Add to Home Screen</b>
                </li>
              </ol>
            </div>

            <div v-else-if="platform === 'desktop'">
              <div class="flex items-center gap-2 mb-3">
                <Monitor class="w-6 h-6 text-purple-600" />
                <h3 class="font-semibold text-lg">Desktop (Chrome / Edge)</h3>
              </div>
              <ol class="space-y-3 text-base">
                <li class="flex items-center gap-3">
                  <Download class="w-5 h-5 text-purple-600" /> 1. Open browser menu
                </li>
                <li class="flex items-center gap-3">
                  <Box class="w-5 h-5 text-purple-600" /> 2. Click <b>Install App</b>
                </li>
              </ol>
            </div>

            <div v-else-if="platform === 'macos'">
              <div class="flex items-center gap-2 mb-3">
                <Laptop class="w-6 h-6 text-pink-600" />
                <h3 class="font-semibold text-lg">macOS (Safari)</h3>
              </div>
              <ol class="space-y-3 text-base">
                <li class="flex items-center gap-3">
                  <Share class="w-5 h-5 text-pink-600" /> 1. Tap the <b>Share</b> icon
                </li>
                <li class="flex items-center gap-3">
                  <Dock class="w-5 h-5 text-pink-600" /> 2. Select <b>Add to Dock</b>
                </li>
              </ol>
            </div>
          </div>
        </UiDialogContent>
      </UiDialog>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Download,
  CheckCircle,
  Smartphone,
  Monitor,
  Laptop,
  Share,
  Box,
  PlusSquare,
  Dock,
} from 'lucide-vue-next'
import Navigator from '@/components/Home/Navigator.vue'
import ToastViewport from '@/components/ToastViewport.vue'
import { useAuthStore } from '@/stores/auth'
import { useInstallPrompt } from '@/composable/useInstallPrompt'

const authStore = useAuthStore()
const route = useRoute()
const { installOpen } = useInstallPrompt()

const isCollapsed = ref(false)
const platform = ref(null)
const theme = ref('system')

const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAuthRoute = computed(() =>
  ['/login', '/register', '/forgot-password', '/reset-password'].includes(route.path),
)

const detectPlatform = () => {
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/macintosh/.test(ua)) return 'macos'
  if (/win|linux/.test(ua)) return 'desktop'
  return 'unknown'
}

const applyTheme = (value) => {
  const isDark =
    value === 'dark' ||
    (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

onMounted(() => {
  theme.value = localStorage.getItem('theme') || 'system'
  applyTheme(theme.value)
  platform.value = detectPlatform()
})
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
