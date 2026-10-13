<template>
<div class="pb-2">
  <div class="max-w-4xl mx-auto space-y-4">
        <!-- ── Welcome header ── -->
        <div class="flex items-center gap-3 sm:gap-4 mb-2">
          <img
            v-if="authStore.user?.avatarUrl"
            :src="authStore.user.avatarUrl"
            alt="Avatar"
            class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover flex-shrink-0 shadow-sm"
          />
          <div
            v-else
            aria-hidden="true"
            class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-lg font-bold bg-primary/10 text-primary"
          >
            {{ initials }}
          </div>
          <div>
            <h2 class="font-display text-2xl sm:text-3xl font-bold leading-tight">
              {{ daypart }}, <span class="text-primary">{{ firstName }}!</span>
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ groupsLine }}
            </p>
          </div>
        </div>

        <!-- ── At a glance ── -->
        <div v-if="userGroups.length > 0" class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users class="w-4 h-4" />
            </span>
            <span class="text-2xl font-bold leading-none">{{ userGroups.length }}</span>
            <span class="text-xs text-muted-foreground">Group{{ userGroups.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock class="w-4 h-4" />
            </span>
            <span class="text-2xl font-bold leading-none">{{ upcomingEvents.length }}</span>
            <span class="text-xs text-muted-foreground">Upcoming</span>
          </div>
        </div>

        <!-- ── Upcoming events ── -->
        <div v-if="userGroups.length > 0" class="space-y-2">
          <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upcoming
          </p>
          <UiCard>
            <UiCardContent class="p-0">
              <ul v-if="upcomingEvents.length" class="divide-y divide-border">
                <li
                  v-for="ev in upcomingEvents.slice(0, 5)"
                  :key="ev.id"
                  class="flex items-center gap-3 px-5 py-3"
                >
                  <GroupBadge :group="ev.group" size="sm" class="flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ ev.title }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ ev.group.name }}</p>
                  </div>
                  <span class="text-xs text-muted-foreground flex-shrink-0">
                    {{ relativeDay(ev.start) }}
                  </span>
                </li>
              </ul>
              <p v-else class="px-5 py-6 text-center text-sm text-muted-foreground">
                Nothing scheduled in the next 30 days.
              </p>
            </UiCardContent>
          </UiCard>
        </div>

        <!-- ── Your groups ── -->
        <div v-if="userGroups.length > 0" class="space-y-2">
          <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Groups
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="group in userGroups"
              :key="group.id"
              @click="$router.push('/group/' + group.id)"
              class="group flex items-center gap-3 p-4 text-left rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-px active:scale-[0.99] transition-all duration-150 ease-out"
            >
              <GroupBadge :group="group" size="md" />
              <p class="flex-1 min-w-0 font-semibold text-sm truncate">{{ group.name }}</p>
              <ChevronRight class="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
            </button>
          </div>
        </div>

        <!-- ── Empty state ── -->
        <UiCard v-else>
          <UiCardContent class="p-8 text-center">
            <div
              class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3"
            >
              <Users class="w-6 h-6" />
            </div>
            <p class="font-semibold mb-1">No groups yet</p>
            <p class="text-sm text-muted-foreground">Create one or join with an invite code below.</p>
          </UiCardContent>
        </UiCard>

        <!-- ── Create + Join ── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Create Group -->
          <UiCard>
            <UiCardContent class="p-5">
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                >
                  <Plus class="w-[1.125rem] h-[1.125rem]" />
                </span>
                <h3 class="font-semibold">Create a Group</h3>
              </div>
              <form @submit.prevent="createGroup" class="space-y-3">
                <div class="flex gap-2 items-start">
                  <div class="flex-1">
                    <UiInput
                      id="group-name"
                      v-model="newGroupName"
                      type="text"
                      placeholder="e.g., Math Class 2024"
                      required
                    />
                  </div>
                  <label class="inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input type="color" v-model="newGroupColor" class="sr-only" />
                    <span
                      class="w-11 h-11 rounded-xl shadow-inner border block"
                      :style="{ backgroundColor: newGroupColor }"
                    ></span>
                  </label>
                </div>
                <UiButton type="submit" :disabled="loadingCreate" class="w-full">
                  <LoaderCircle v-if="loadingCreate" class="h-4 w-4 animate-spin" />
                  {{ loadingCreate ? 'Creating…' : 'Create Group' }}
                </UiButton>
                <p v-if="createError" class="text-destructive text-xs">{{ createError }}</p>
              </form>
            </UiCardContent>
          </UiCard>

          <!-- Join Group -->
          <UiCard>
            <UiCardContent class="p-5">
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                >
                  <Mail class="w-[1.125rem] h-[1.125rem]" />
                </span>
                <h3 class="font-semibold">Join with Code</h3>
              </div>
              <form @submit.prevent="joinGroup" class="space-y-3">
                <UiInput
                  id="invite-code"
                  v-model="inviteCode"
                  type="text"
                  placeholder="Enter code or invite link"
                  required
                />
                <p v-if="joinError" class="text-destructive text-xs -mt-1">{{ joinError }}</p>
                <UiButton type="submit" :disabled="loadingJoin" class="w-full">
                  <LoaderCircle v-if="loadingJoin" class="h-4 w-4 animate-spin" />
                  {{ loadingJoin ? 'Joining…' : 'Join Group' }}
                </UiButton>
              </form>
            </UiCardContent>
          </UiCard>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import * as groupService from '@/lib/services/groups'
import * as eventsService from '@/lib/services/events'
import GroupBadge from '@/components/GroupBadge.vue'
import { Users, Mail, ChevronRight, Plus, LoaderCircle, CalendarClock } from 'lucide-vue-next'

const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const userGroups = ref([])
const upcomingEvents = ref([])
const newGroupName = ref('')
const newGroupColor = ref('#f43f5e')
const inviteCode = ref('')
const loadingCreate = ref(false)
const loadingJoin = ref(false)
const joinError = ref('')
const createError = ref('')

const firstName = computed(() => authStore.user?.name?.split(' ')[0] || 'there')
const initials = computed(() =>
  (authStore.user?.name || 'U')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
const daypart = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})
const groupsLine = computed(() => {
  const n = userGroups.value.length
  if (n === 0) return 'Create your first group to get started.'
  return `${n} group${n === 1 ? '' : 's'} · pick one to see what's on.`
})

const stringToColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 90%, 55%)`
}

const relativeDay = (start) => {
  const d = new Date(start)
  const today = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diff = Math.round((day(d) - day(today)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const loadUpcoming = async () => {
  const from = new Date()
  const to = new Date(Date.now() + 30 * 86400000)
  const all = []
  await Promise.all(
    userGroups.value.map(async (g) => {
      try {
        const res = await eventsService.listByGroup(g.id, { from, to })
        for (const ev of res?.events || []) all.push({ ...ev, group: g })
      } catch (err) {
        console.error('Failed to load events for group', g.id, err)
      }
    }),
  )
  all.sort((a, b) => new Date(a.start) - new Date(b.start))
  upcomingEvents.value = all
}

const loadGroups = async () => {
  if (!authStore.user) return
  try {
    await groupsStore.fetchAll()
    userGroups.value = groupsStore.items.map((g) => ({
      ...g,
      color: g.color || stringToColor(g.id),
    }))
    await loadUpcoming()
  } catch (err) {
    console.error('Failed to load groups:', err)
  }
}

const createGroup = async () => {
  loadingCreate.value = true
  createError.value = ''
  try {
    await groupsStore.createGroup({
      name: newGroupName.value,
      color: newGroupColor.value || '#f43f5e',
    })
    newGroupName.value = ''
    await loadGroups()
  } catch (err) {
    createError.value = 'Failed to create group.'
    console.error(err)
  } finally {
    loadingCreate.value = false
  }
}

const normalizeInviteCode = (raw) => {
  const trimmed = (raw || '').trim()
  const lastSegment = trimmed.split('/').filter(Boolean).pop() || ''
  return decodeURIComponent(lastSegment).toUpperCase()
}

const joinGroup = async () => {
  loadingJoin.value = true
  joinError.value = ''
  try {
    await groupService.joinByCode(normalizeInviteCode(inviteCode.value))
    inviteCode.value = ''
    await loadGroups()
  } catch (err) {
    joinError.value = err?.code === 'not_found' ? 'Invalid invite code.' : 'Could not join group.'
    console.error(err)
  } finally {
    loadingJoin.value = false
  }
}

onMounted(async () => {
  await authStore.initAuth()
  await loadGroups()
})
</script>
