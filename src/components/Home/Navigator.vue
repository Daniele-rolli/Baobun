<!-- Sidebar.vue -->
<template>
  <!-- Desktop / Tablet Sidebar -->
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 hidden md:flex flex-col transition-[width] duration-200 ease-[var(--ease-snappy)] m-3 rounded-3xl border bg-card shadow-md',
      'max-h-[calc(100vh-1.5rem)] overflow-hidden',
      collapsed ? 'w-20' : 'w-64',
    ]"
    role="navigation"
    aria-label="Primary"
  >
    <!-- Collapse Button -->
    <div
      class="p-3 flex"
      :class="{ 'items-center justify-center': collapsed }"
    >
      <button
        @click="toggleSidebar"
        class="flex items-center justify-center h-10 w-10 hover:bg-muted rounded-full active:scale-95 transition-[background-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Toggle sidebar"
      >
        <ChevronLeft v-if="!collapsed" class="h-5 w-5 text-muted-foreground" />
        <ChevronRight v-else class="h-5 w-5 text-muted-foreground" />
      </button>
    </div>

    <div class="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
      <router-link
        to="/dashboard"
        class="flex items-center px-3 py-2.5 hover:bg-muted hover:text-primary rounded-full active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        active-class="!bg-primary/15 !text-primary font-medium"
        :class="[collapsed ? 'justify-center' : 'justify-start']"
      >
        <Home class="h-5 w-5" :class="{ 'mr-3': !collapsed }" />
        <span v-if="!collapsed">Dashboard</span>
      </router-link>

      <div class="pt-4">
        <h3
          v-if="!collapsed"
          class="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2"
        >
          Your Groups
        </h3>

        <ul class="space-y-1">
          <li v-for="group in userGroups" :key="group.id">
            <button
              class="w-full flex items-center px-3 py-2.5 text-sm hover:bg-muted hover:text-primary rounded-full active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="[collapsed ? 'justify-center' : 'justify-start']"
              @click="$router.push('/group/' + group.id)"
            >
              <GroupBadge
                :group="group"
                size="sm"
                class="shrink-0"
                :class="{ 'mr-3': !collapsed }"
              />
              <span v-if="!collapsed" class="truncate">{{ group.name }}</span>
            </button>
          </li>

          <li
            v-if="userGroups.length === 0 && !collapsed"
            class="px-3 text-sm text-muted-foreground italic"
          >
            No groups yet
          </li>
        </ul>
      </div>
    </div>

    <!-- Profile Popover -->
    <div class="p-3 flex border-t w-full">
      <UiPopover v-model:open="avatarActive">
        <UiPopoverTrigger as-child>
          <button
            class="flex items-center w-full rounded-2xl px-3 py-2 hover:bg-muted active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="collapsed ? 'justify-center' : 'justify-start space-x-2'"
            aria-label="Open profile menu"
          >
            <AvatarImg
              :src="authStore.user?.avatarUrl"
              :name="authStore.user?.name || 'User'"
              class="rounded-full h-8 w-8"
              :class="{ 'ring-2 ring-primary ring-offset-2': avatarActive }"
            />
            <span v-if="!collapsed" class="font-medium truncate max-w-[10rem]">{{
              authStore.user?.name
            }}</span>
          </button>
        </UiPopoverTrigger>

        <UiPopoverContent side="top" align="start" class="w-64 p-2">
          <div class="">
            <div class="px-3 py-2">
              <p class="font-semibold truncate">{{ authStore.user?.name }}</p>
              <p class="text-sm text-muted-foreground truncate">{{ authStore.user?.email }}</p>
            </div>
            <div class="py-1">
              <router-link
                to="/profile"
                class="block px-3 py-2.5 hover:bg-muted rounded-lg"
                >Profile</router-link
              >
              <router-link
                to="/settings"
                class="block px-3 py-2.5 hover:bg-muted rounded-lg"
                >Settings</router-link
              >
            </div>
            <div class="py-1">
              <button
                @click="logout"
                class="w-full text-left px-3 py-2.5 hover:bg-destructive/10 text-destructive rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </UiPopoverContent>
      </UiPopover>
    </div>
  </aside>

  <!-- Mobile Bottom Navbar — iOS 26 "liquid glass" floating capsule + detached action -->
  <div
    class="mobile-dock md:hidden fixed inset-x-4 z-40 flex items-center justify-between gap-3"
    :style="{ bottom: 'calc(0.9rem + env(safe-area-inset-bottom, 0px))' }"
  >
    <nav
      class="mobile-glass-nav flex-1 max-w-[17rem] rounded-full border border-border bg-white/90 dark:bg-card/80 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="navigation"
      aria-label="Mobile"
    >
      <div class="relative grid grid-cols-3 items-center px-1.5 py-1.5">
        <!-- Sliding active pill -->
        <span
          aria-hidden="true"
          class="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-0.75rem)/3)] rounded-full bg-primary/15 transition-[transform,opacity] duration-300 ease-[var(--ease-snappy)]"
          :style="{ transform: `translateX(${activeIndex < 0 ? 0 : activeIndex * 100}%)`, opacity: activeIndex < 0 ? 0 : 1 }"
        ></span>

        <!-- Home -->
        <router-link
          to="/dashboard"
          class="relative grid place-items-center h-11 w-11 mx-auto rounded-full transition-[color,transform] duration-200 ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="$route.path === '/dashboard' ? 'text-primary' : 'text-muted-foreground'"
          aria-label="Home"
        >
          <Home class="h-5 w-5" />
        </router-link>

        <!-- Groups -->
        <button
          class="relative grid place-items-center h-11 w-11 mx-auto rounded-full transition-[color,transform] duration-200 ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="isGroupRoute ? 'text-primary' : 'text-muted-foreground'"
          aria-label="Groups"
          @click="goToFirstGroup()"
        >
          <Users class="h-5 w-5" />
        </button>

        <!-- Profile / Settings -->
        <router-link
          to="/settings"
          class="relative grid place-items-center h-11 w-11 mx-auto rounded-full transition-[color,transform] duration-200 ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="$route.path === '/settings' ? 'text-primary' : 'text-muted-foreground'"
          aria-label="Settings"
        >
          <AvatarImg
            :src="authStore.user?.avatarUrl"
            :name="authStore.user?.name || 'User'"
            class="rounded-full h-5 w-5"
          />
        </router-link>
      </div>
    </nav>

    <!-- Detached: Add Event (outside the bar, to the right) -->
    <button
      class="shrink-0 grid place-items-center h-14 w-14 rounded-full bg-primary text-primary-foreground border border-white/25 dark:border-white/15 shadow-[0_8px_22px_-6px_var(--tw-shadow-color)] shadow-primary/45 transition-transform duration-200 ease-[var(--ease-snappy)] hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      :class="{ 'opacity-40 cursor-not-allowed hover:scale-100': !canAddEvent }"
      :disabled="!canAddEvent"
      aria-label="Add event"
      @click="goToAddEvent()"
    >
      <Plus class="h-6 w-6" />
    </button>
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import { Home, Users, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import AvatarImg from '@/components/AvatarImg.vue'
import GroupBadge from '@/components/GroupBadge.vue'

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
const ADD_ROLES = ['OWNER', 'ADMIN', 'MEMBER']
const targetGroup = computed(() => {
  if (isGroupRoute.value) {
    return userGroups.value.find((group) => group.id === route.params.id)
  }
  return userGroups.value.find((group) => ADD_ROLES.includes(group.role)) || userGroups.value[0]
})
const canAddEvent = computed(() => !targetGroup.value || ADD_ROLES.includes(targetGroup.value.role))

const activeIndex = computed(() => {
  if (route.path === '/dashboard') return 0
  if (isGroupRoute.value) return 1
  if (route.path === '/settings') return 2
  return -1
})

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
  if (isGroupRoute.value) return // already in a group: act as an active tab, don't jump groups
  if (userGroups.value.length > 0) {
    router.push('/group/' + userGroups.value[0].id)
  } else {
    router.push('/dashboard')
  }
}

// Add event: navigate to current group or first group
const goToAddEvent = () => {
  // If on a group page, emit an event; otherwise navigate to first group
  if (isGroupRoute.value) {
    // Dispatch a custom event that the group page can listen to
    window.dispatchEvent(new CustomEvent('baobun:add-event'))
  } else if (targetGroup.value) {
    router.push('/group/' + targetGroup.value.id)
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

<style scoped>
@keyframes dock-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mobile-dock {
  animation: dock-rise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-transparency: reduce) {
  .mobile-glass-nav {
    background: var(--card);
    border-color: var(--border);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mobile-dock {
    animation: none;
  }
  .mobile-glass-nav,
  .mobile-glass-nav * {
    transition-duration: 0.001ms !important;
  }
}
</style>
