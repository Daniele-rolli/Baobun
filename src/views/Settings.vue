<template>
  <div class="min-h-screen">
    <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
      <!-- ── Profile card ── -->
      <UiCard class="p-5">
        <UiCardContent>
          <div class="flex items-center gap-4">
            <img
              :src="
                authStore.user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'U')}&background=random&size=96`
              "
              alt="Avatar"
              class="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-sm"
            />
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">
                {{ authStore.user?.name || '—' }}
              </p>
              <p class="text-sm text-muted-foreground truncate mt-0.5">{{ authStore.user?.email }}</p>
            </div>
            <router-link
              to="/profile"
              class="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
              style="min-height: 0"
            >
              Edit
              <ChevronRightIcon class="w-4 h-4" />
            </router-link>
          </div>
        </UiCardContent>
      </UiCard>

      <!-- ── Appearance ── -->
      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Appearance
        </p>
        <UiCard class="overflow-hidden">
          <!-- Theme row -->
          <div class="px-4 py-3.5 border-b">
            <p class="text-sm font-medium mb-3">Theme</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="theme in themes"
                :key="theme.value"
                @click="setTheme(theme.value)"
                class="flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all touch-exempt"
                style="min-height: 0; min-width: 0"
                :class="
                  selectedTheme === theme.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : ' text-muted-foreground hover:bg-muted'
                "
              >
                <component
                  :is="theme.icon"
                  class="w-5 h-5"
                  :class="selectedTheme === theme.value ? '' : theme.iconClass"
                />
                {{ theme.label }}
              </button>
            </div>
          </div>

          <!-- Calendar & date/time preferences -->
          <div class="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <CalendarDays class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Week starts on</p>
            </div>
            <UiSelect v-model="weekStartsOnModel">
              <UiSelectTrigger class="w-auto text-xs sm:text-sm">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in weekStartOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div class="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Calendar class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Date format</p>
            </div>
            <UiSelect v-model="dateFormatModel">
              <UiSelectTrigger class="w-auto text-xs sm:text-sm">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in dateFormatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div class="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Clock3 class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Time format</p>
            </div>
            <UiSelect v-model="timeFormatModel">
              <UiSelectTrigger class="w-auto text-xs sm:text-sm">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in timeFormatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </UiCard>
      </div>

      <!-- ── Groups ── -->
      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Groups
        </p>
        <UiCard class="overflow-hidden">
          <router-link
            to="/groupSettings"
            class="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Users class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Manage Groups</p>
              <p class="text-xs text-muted-foreground mt-0.5">Settings, members &amp; tags</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </router-link>

          <router-link
            to="/dashboard"
            class="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <LayoutDashboard class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Dashboard</p>
              <p class="text-xs text-muted-foreground mt-0.5">Create or join a group</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </router-link>

          <router-link
            to="/settings/migration"
            class="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Database class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Migration</p>
              <p class="text-xs text-muted-foreground mt-0.5">Appwrite import report</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </router-link>
        </UiCard>
      </div>

      <!-- ── Notifications ── -->
      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </p>
        <UiCard class="overflow-hidden">
          <div class="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Bell class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Push Notifications</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{
                  notificationsStore.unsupported
                    ? 'Not supported on this browser'
                    : 'Event reminders & updates'
                }}
              </p>
            </div>
            <!-- toggle -->
            <UiSwitch
              :model-value="notificationsStore.enabled"
              :disabled="notificationsStore.unsupported"
              @update:model-value="toggleNotifications"
            />
          </div>
          <div class="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <Clock3 class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Remind me before</p>
            </div>
            <UiSelect v-model="notificationLeadModel" :disabled="!notificationsStore.enabled">
              <UiSelectTrigger class="w-auto text-xs sm:text-sm">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem :value="2880">2 days before</UiSelectItem>
                <UiSelectItem :value="1440">1 day before</UiSelectItem>
                <UiSelectItem :value="0">Same day</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </UiCard>
      </div>

      <!-- ── Account ── -->
      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </p>
        <UiCard class="overflow-hidden">
          <router-link
            to="/profile"
            class="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <UserCircle class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Edit Profile</p>
              <p class="text-xs text-muted-foreground mt-0.5">Name, email, password, avatar</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </router-link>

          <router-link
            to="/api-access"
            class="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <KeyRound class="h-[1.125rem] w-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">API Access</p>
              <p class="mt-0.5 text-xs text-muted-foreground">Read-only integration tokens</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </router-link>

          <div
            class="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
            @click="openInstall"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Download class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-medium">Install app</p>
              <p class="mt-0.5 text-xs text-muted-foreground">Add Baobun to your home screen</p>
            </div>
            <ChevronRightIcon
              class="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
          </div>

          <div
            class="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
            @click="confirmLogout"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
            >
              <LogOut class="w-[1.125rem] h-[1.125rem]" />
            </span>
            <span class="flex-1 text-sm font-medium text-destructive">Log Out</span>
          </div>
        </UiCard>
      </div>

      <!-- ── App info ── -->
      <p class="text-center text-xs text-muted-foreground pb-2">Baobun · v1.0.0</p>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useNotificationsStore } from '@/stores/notifications'
import { useRouter } from 'vue-router'
import { useInstallPrompt } from '@/composable/useInstallPrompt'
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
  KeyRound,
  Database,
  Download,
} from 'lucide-vue-next'

export default {
  name: 'Settings',
  components: {
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
    KeyRound,
    Database,
    Download,
  },
  setup() {
    const authStore = useAuthStore()
    const preferencesStore = usePreferencesStore()
    const notificationsStore = useNotificationsStore()
    const router = useRouter()
    const { openInstall } = useInstallPrompt()

    const themes = [
      { label: 'Light', value: 'light', icon: Sun, iconClass: 'text-primary' },
      { label: 'Dark', value: 'dark', icon: Moon, iconClass: 'text-primary' },
      { label: 'System', value: 'system', icon: Monitor, iconClass: 'text-muted-foreground' },
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

    return {
      authStore,
      themes,
      selectedTheme,
      setTheme,
      confirmLogout,
      weekStartOptions,
      dateFormatOptions,
      timeFormatOptions,
      weekStartsOnModel,
      dateFormatModel,
      timeFormatModel,
      notificationsStore,
      notificationLeadModel,
      toggleNotifications,
      openInstall,
    }
  },
}
</script>
