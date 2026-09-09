<!-- Sidebar.vue -->
<template>
  <!-- Desktop / Tablet Sidebar -->
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 hidden md:flex flex-col transition-all duration-300 m-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800/95 shadow-sm backdrop-blur-sm',
      'max-h-[calc(100vh-1.5rem)] overflow-hidden',
      collapsed ? 'w-20' : 'w-64',
    ]"
    role="navigation"
    aria-label="Primary"
  >
    <!-- Collapse Button -->
    <div
      class="p-3 flex border-b border-neutral-200 dark:border-neutral-700"
      :class="{ 'items-center justify-center': collapsed }"
    >
      <button
        @click="toggleSidebar"
        class="flex items-center justify-center p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md"
        aria-label="Toggle sidebar"
      >
        <ChevronLeft v-if="!collapsed" class="h-5 w-5 text-neutral-600 dark:text-neutral-100" />
        <ChevronRight v-else class="h-5 w-5 text-neutral-600 dark:text-neutral-100" />
      </button>
    </div>

    <div class="px-3 py-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
      <router-link
        to="/dashboard"
        class="flex items-center px-3 py-2 text-neutral-700 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-rose-600 rounded-md transition"
        :class="[collapsed ? 'justify-center' : 'justify-start']"
      >
        <Home class="h-5 w-5" :class="{ 'mr-3': !collapsed }" />
        <span v-if="!collapsed">Dashboard</span>
      </router-link>

      <div class="pt-4">
        <h3
          v-if="!collapsed"
          class="px-3 text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2"
        >
          Your Groups
        </h3>

        <ul class="space-y-1">
          <li v-for="group in userGroups" :key="group.$id">
            <button
              class="w-full flex items-center px-3 py-2 text-sm text-neutral-700 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-rose-600 rounded-md transition"
              :class="[collapsed ? 'justify-center' : 'justify-start']"
              @click="$router.push('/group/' + group.$id)"
            >
              <Users class="h-5 w-5" :class="{ 'mr-3': !collapsed }" />
              <span v-if="!collapsed" class="truncate">{{ group.name }}</span>
            </button>
          </li>

          <li
            v-if="userGroups.length === 0 && !collapsed"
            class="px-3 text-sm text-neutral-400 italic"
          >
            No groups yet
          </li>
        </ul>
      </div>
    </div>

    <!-- Profile Popover -->
    <div class="p-3 flex border-t border-neutral-200 dark:border-neutral-700 w-full">
      <UiPopover v-model:open="avatarActive">
        <UiPopoverTrigger as-child>
          <button
            class="flex items-center focus:outline-none w-full rounded-md px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            :class="collapsed ? 'justify-center' : 'justify-start space-x-2'"
            aria-label="Open profile menu"
          >
            <img
              :src="
                authStore.user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'User')}&background=random`
              "
              alt="User Avatar"
              class="rounded-full h-8 w-8 transition-all"
              :class="{ 'ring-2 ring-rose-500 ring-offset-2': avatarActive }"
            />
            <span v-if="!collapsed" class="font-medium truncate max-w-[10rem]">{{
              authStore.user?.name
            }}</span>
          </button>
        </UiPopoverTrigger>

        <UiPopoverContent side="top" align="start" class="w-64 p-2">
          <div class="dark:text-white">
            <div class="px-3 py-2">
              <p class="font-semibold">{{ authStore.user?.name }}</p>
              <p class="text-sm text-neutral-500">{{ authStore.user?.email }}</p>
            </div>
            <div class="py-1">
              <router-link
                to="/profile"
                class="block px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                >Profile</router-link
              >
              <router-link
                to="/settings"
                class="block px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                >Settings</router-link
              >
            </div>
            <div class="py-1">
              <button
                @click="logout"
                class="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </UiPopoverContent>
      </UiPopover>
    </div>
  </aside>

  <!-- Mobile Bottom Navbar -->
  <nav
    class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200/70 dark:border-neutral-700/70 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]"
    role="navigation"
    aria-label="Mobile"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
  >
    <ul class="flex items-center justify-around h-16 px-1">
      <!-- Home -->
      <li class="flex-1">
        <router-link
          to="/dashboard"
          class="flex flex-col items-center gap-0.5 text-neutral-400 dark:text-neutral-500 hover:text-rose-600 dark:hover:text-rose-500 transition-colors"
          active-class="!text-rose-600 dark:!text-rose-500"
        >
          <span
            class="w-10 h-7 flex items-center justify-center rounded-full"
            :class="$route.path === '/dashboard' ? 'bg-rose-50 dark:bg-rose-600/15' : ''"
          >
            <Home class="h-5 w-5" />
          </span>
          <span class="text-[10px] font-medium leading-none">Home</span>
        </router-link>
      </li>

      <!-- Groups -->
      <li class="flex-1">
        <button
          class="w-full flex flex-col items-center gap-0.5 transition-colors"
          :class="
            isGroupRoute
              ? 'text-rose-600 dark:text-rose-500'
              : 'text-neutral-400 dark:text-neutral-500 hover:text-rose-600'
          "
          @click="goToFirstGroup()"
        >
          <span
            class="w-10 h-7 flex items-center justify-center rounded-full"
            :class="isGroupRoute ? 'bg-rose-50 dark:bg-rose-600/15' : ''"
          >
            <Users class="h-5 w-5" />
          </span>
          <span class="text-[10px] font-medium leading-none">Groups</span>
        </button>
      </li>

      <!-- FAB: Add Event -->
      <li class="flex-1 flex justify-center">
        <button
          class="-mt-5 w-14 h-14 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-2xl shadow-lg shadow-rose-500/30 flex items-center justify-center transition-all duration-150"
          :class="{ 'opacity-40 cursor-not-allowed hover:bg-rose-500': !canAddEvent }"
          :disabled="!canAddEvent"
          aria-label="Add event"
          @click="goToAddEvent()"
        >
          <Plus class="h-7 w-7" />
        </button>
      </li>

      <!-- Calendar -->
      <li class="flex-1">
        <button
          class="w-full flex flex-col items-center gap-0.5 transition-colors"
          :class="
            isGroupRoute
              ? 'text-neutral-400 dark:text-neutral-500'
              : 'text-neutral-400 dark:text-neutral-500 hover:text-rose-600'
          "
          @click="goToCalendar()"
        >
          <span class="w-10 h-7 flex items-center justify-center rounded-full">
            <CalendarDays class="h-5 w-5" />
          </span>
          <span class="text-[10px] font-medium leading-none">Calendar</span>
        </button>
      </li>

      <!-- Profile / Settings -->
      <li class="flex-1">
        <router-link
          to="/settings"
          class="flex flex-col items-center gap-0.5 text-neutral-400 dark:text-neutral-500 hover:text-rose-600 dark:hover:text-rose-500 transition-colors"
          active-class="!text-rose-600 dark:!text-rose-500"
        >
          <span
            class="w-10 h-7 flex items-center justify-center rounded-full overflow-visible"
            :class="$route.path === '/settings' ? 'bg-rose-50 dark:bg-rose-600/15' : ''"
          >
            <img
              :src="
                authStore.user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'User')}&background=random`
              "
              alt="User Avatar"
              class="rounded-full h-6 w-6 object-cover"
            />
          </span>
          <span class="text-[10px] font-medium leading-none">Me</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import { Home, Users, ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-vue-next'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const userGroups = ref([])
const avatarActive = ref(false)

const isGroupRoute = computed(() => route.path.startsWith('/group/'))
const targetGroup = computed(() => {
  if (isGroupRoute.value) {
    return userGroups.value.find((group) => group.$id === route.params.id)
  }
  return userGroups.value.find((group) => group.role !== 'VIEWER') || userGroups.value[0]
})
const canAddEvent = computed(() => !targetGroup.value || targetGroup.value.role !== 'VIEWER')

const loadGroups = async () => {
  if (!authStore.user) return
  try {
    await groupsStore.fetchAll()
    userGroups.value = groupsStore.items
  } catch (err) {
    console.error('Failed to load groups:', err)
  }
}

const goToFirstGroup = () => {
  if (userGroups.value.length > 0) {
    router.push('/group/' + userGroups.value[0].$id)
  } else {
    router.push('/dashboard')
  }
}

// Navigate to calendar: if currently in a group, stay on that group page (it has the calendar)
const goToCalendar = () => {
  if (isGroupRoute.value) return // already on calendar
  goToFirstGroup()
}

// Add event: navigate to current group or first group
const goToAddEvent = () => {
  // If on a group page, emit an event; otherwise navigate to first group
  if (isGroupRoute.value) {
    // Dispatch a custom event that the group page can listen to
    window.dispatchEvent(new CustomEvent('baobun:add-event'))
  } else if (targetGroup.value) {
    router.push('/group/' + targetGroup.value.$id)
  } else {
    router.push('/dashboard')
  }
}

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}

const toggleSidebar = () => {
  emit('toggle')
}
onMounted(loadGroups)
</script>
