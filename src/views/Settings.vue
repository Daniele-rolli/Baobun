<template>
  <div class="min-h-screen dark:text-white">
    <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
      <Card class="p-5">
        <CardContent class="px-0">
          <div class="flex items-center gap-4">
            <img
              :src="authStore.user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'U')}&background=random&size=96`"
              alt="Avatar"
              class="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-sm"
            />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-neutral-900 dark:text-white truncate">{{ authStore.user?.name || '—' }}</p>
              <p class="text-sm text-neutral-500 truncate mt-0.5">{{ authStore.user?.email }}</p>
            </div>
            <router-link
              to="/profile"
              class="flex-shrink-0 flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-colors"
            >
              Edit
              <ChevronRightIcon class="w-4 h-4" />
            </router-link>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-2">
        <p class="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Appearance</p>
        <Card>
          <CardContent class="px-0">
            <div class="px-4 sm:px-6 py-3.5">
              <p class="text-sm font-medium mb-3">Theme</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="theme in themes"
                  :key="theme.value"
                  @click="setTheme(theme.value)"
                  class="flex flex-col items-center gap-1.5 py-3 min-h-[44px] rounded-xl border text-sm font-medium transition-all"
                  :class="selectedTheme === theme.value
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'"
                >
                  <component :is="theme.icon" class="w-5 h-5" :class="selectedTheme === theme.value ? '' : theme.iconClass" />
                  {{ theme.label }}
                </button>
              </div>
            </div>
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-blue-50 dark:bg-blue-500/15 text-blue-500">
                <CalendarDays class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Week starts on</p>
              </div>
              <select
                v-model.number="weekStartsOnModel"
                class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 min-h-[44px] text-xs sm:text-sm text-neutral-700 dark:text-neutral-200"
              >
                <option v-for="opt in weekStartOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500">
                <Calendar class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Date format</p>
              </div>
              <select
                v-model="dateFormatModel"
                class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 min-h-[44px] text-xs sm:text-sm text-neutral-700 dark:text-neutral-200"
              >
                <option v-for="opt in dateFormatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-500">
                <Clock3 class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Time format</p>
              </div>
              <select
                v-model="timeFormatModel"
                class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 min-h-[44px] text-xs sm:text-sm text-neutral-700 dark:text-neutral-200"
              >
                <option v-for="opt in timeFormatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Groups</p>
        <Card>
          <CardContent class="px-0">
            <router-link to="/groupSettings" class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-violet-50 dark:bg-violet-500/15 text-violet-500">
                <Users class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Manage Groups</p>
                <p class="text-xs text-neutral-400 mt-0.5">Settings, members &amp; tags</p>
              </div>
              <ChevronRightIcon class="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
            </router-link>
            <router-link to="/dashboard" class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-500">
                <LayoutDashboard class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Dashboard</p>
                <p class="text-xs text-neutral-400 mt-0.5">Create or join a group</p>
              </div>
              <ChevronRightIcon class="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
            </router-link>
            <router-link to="/settings/migration" class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-amber-50 dark:bg-amber-500/15 text-amber-500">
                <Database class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Appwrite migration</p>
                <p class="text-xs text-neutral-400 mt-0.5">Review dry-run report</p>
              </div>
              <ChevronRightIcon class="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
            </router-link>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Notifications</p>
        <Card>
          <CardContent class="px-0">
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px]">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-rose-50 dark:bg-rose-500/15 text-rose-500">
                <Bell class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Push Notifications</p>
                <p class="text-xs text-neutral-400 mt-0.5">
                  {{ notificationsStore.unsupported ? 'Not supported on this browser' : 'Event reminders & updates' }}
                </p>
              </div>
              <Switch
                :model-value="notificationsStore.enabled"
                :disabled="notificationsStore.unsupported"
                @update:model-value="toggleNotifications"
              />
            </div>
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300">
                <Clock3 class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Remind me before</p>
              </div>
              <select
                v-model.number="notificationLeadModel"
                :disabled="!notificationsStore.enabled"
                class="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 min-h-[44px] text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 disabled:opacity-50"
              >
                <option :value="2880">2 days before</option>
                <option :value="1440">1 day before</option>
                <option :value="0">Same day</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Account</p>
        <Card>
          <CardContent class="px-0">
            <router-link to="/profile" class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300">
                <UserCircle class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium">Edit Profile</p>
                <p class="text-xs text-neutral-400 mt-0.5">Name, email, password, avatar</p>
              </div>
              <ChevronRightIcon class="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
            </router-link>
            <div class="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] border-t border-neutral-100 dark:border-neutral-700/50 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors" @click="confirmLogout">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-red-50 dark:bg-red-500/15 text-red-500">
                <LogOut class="w-[1.125rem] h-[1.125rem]" />
              </span>
              <span class="flex-1 text-sm font-medium text-red-500">Log Out</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p class="text-center text-xs text-neutral-300 dark:text-neutral-600 pb-2">
        Baobun · v1.0.0
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useNotificationsStore } from '@/stores/notifications'
import { formatDateNumeric, formatTime } from '@/lib/dateTimePreferences'
import {
  ChevronRightIcon,
  Users,
  Sun,
  Moon,
  Monitor,
  Bell,
  LogOut,
  UserCircle,
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Clock3,
  Database,
} from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const notificationsStore = useNotificationsStore()
const router = useRouter()

const themes = [
  { label: 'Light', value: 'light', icon: Sun, iconClass: 'text-yellow-500' },
  { label: 'Dark', value: 'dark', icon: Moon, iconClass: 'text-blue-500' },
  { label: 'System', value: 'system', icon: Monitor, iconClass: 'text-neutral-500' },
]
const selectedTheme = ref('system')
const weekStartOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const sampleDate = new Date(2026, 0, 31, 13, 45)
const dateFormatOptions = computed(() => [
  { value: 'mdy', label: `MM/DD/YYYY (${formatDateNumeric(sampleDate, 'mdy')})` },
  { value: 'dmy', label: `DD/MM/YYYY (${formatDateNumeric(sampleDate, 'dmy')})` },
  { value: 'ymd', label: `YYYY-MM-DD (${formatDateNumeric(sampleDate, 'ymd')})` },
])
const timeFormatOptions = computed(() => [
  { value: '12h', label: `12-hour (${formatTime(sampleDate, '12h')})` },
  { value: '24h', label: `24-hour (${formatTime(sampleDate, '24h')})` },
])

const weekStartsOnModel = computed({
  get: () => preferencesStore.weekStartsOn,
  set: (value) => preferencesStore.setWeekStartsOn(value),
})
const dateFormatModel = computed({
  get: () => preferencesStore.dateFormat,
  set: (value) => preferencesStore.setDateFormat(value),
})
const timeFormatModel = computed({
  get: () => preferencesStore.timeFormat,
  set: (value) => preferencesStore.setTimeFormat(value),
})
const notificationLeadModel = computed({
  get: () => notificationsStore.leadMinutes,
  set: (value) => notificationsStore.setLeadMinutes(value),
})

const applyTheme = (theme) => {
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else if (theme === 'light') document.documentElement.classList.remove('dark')
  else {
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark')
  }
}

const setTheme = (theme) => {
  selectedTheme.value = theme
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

const confirmLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const toggleNotifications = async (value) => {
  await notificationsStore.setEnabled(value)
}

onMounted(() => {
  const saved = localStorage.getItem('theme') || 'system'
  selectedTheme.value = saved
  applyTheme(saved)
  notificationsStore.syncPermission()
  notificationsStore.normalizeLeadMinutes()
})
</script>
