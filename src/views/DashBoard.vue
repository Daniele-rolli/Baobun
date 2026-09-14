<template>
  <div class="min-h-screen">
    <div class="p-4 sm:p-6 overflow-y-auto">
      <div class="max-w-4xl mx-auto space-y-5">
        <!-- ── Welcome header ── -->
        <div class="flex items-center gap-3 sm:gap-4 mb-2">
          <img
            :src="
              authStore.user?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'User')}&background=random`
            "
            alt="Avatar"
            class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover flex-shrink-0 shadow-sm"
          />
          <div>
            <h2
              class="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white leading-tight"
            >
              {{ welcomePrefix }}, <span class="text-rose-600">{{ firstName }}!</span>
            </h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {{ welcomeSubtitle }}
            </p>
          </div>
        </div>

        <!-- ── Your groups ── -->
        <div v-if="userGroups.length > 0" class="space-y-2">
          <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Groups
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              v-for="group in userGroups"
              :key="group.id"
              @click="$router.push('/group/' + group.id)"
              class="group flex items-center gap-3 p-4 text-left hover:shadow-md active:scale-[0.99] transition-all"
            >
              <div
                class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm"
                :style="{ backgroundColor: colorToRgba(group.color, 0.15), color: group.color }"
              >
                {{ group.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm text-neutral-800 dark:text-white truncate">
                  {{ group.name }}
                </p>
                <p class="text-xs text-neutral-400 mt-0.5">
                  {{ counts[group.id] || 0 }} member{{ counts[group.id] !== 1 ? 's' : '' }}
                </p>
              </div>
              <ChevronRight
                class="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity"
              />
            </button>
          </div>
        </div>

        <!-- ── Empty state ── -->
        <Card v-else class="p-8 text-center">
          <CardContent>
            <div
              class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto mb-3"
            >
              <Users class="w-6 h-6" />
            </div>
            <p class="font-semibold text-neutral-800 dark:text-white mb-1">No groups yet</p>
            <p class="text-sm text-neutral-400">Create one or join with an invite code below.</p>
          </CardContent>
        </Card>

        <!-- ── Create + Join ── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Create Group -->
          <Card class="p-5">
            <CardContent>
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/15"
                >
                  <Plus class="w-[1.125rem] h-[1.125rem]" />
                </span>
                <h3 class="font-semibold text-neutral-800 dark:text-white">Create a Group</h3>
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
                      class="w-11 h-11 rounded-xl shadow-inner border border-neutral-200 dark:border-neutral-700 block"
                      :style="{ backgroundColor: newGroupColor }"
                    ></span>
                  </label>
                </div>
                <Button type="submit" :disabled="loadingCreate" class="w-full">
                  {{ loadingCreate ? 'Creating…' : 'Create Group' }}
                </Button>
              </form>
            </CardContent>
          </Card>

          <!-- Join Group -->
          <Card class="p-5">
            <CardContent>
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15"
                >
                  <Mail class="w-[1.125rem] h-[1.125rem]" />
                </span>
                <h3 class="font-semibold text-neutral-800 dark:text-white">Join with Code</h3>
              </div>
              <form @submit.prevent="joinGroup" class="space-y-3">
                <UiInput
                  id="invite-code"
                  v-model="inviteCode"
                  type="text"
                  placeholder="Enter code (e.g. ABC123)"
                  required
                />
                <p v-if="joinError" class="text-red-500 text-xs -mt-1">{{ joinError }}</p>
                <button
                  type="submit"
                  :disabled="loadingJoin"
                  class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
                  style="min-height: 44px"
                >
                  {{ loadingJoin ? 'Joining…' : 'Join Group' }}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import * as groupService from '@/lib/services/groups'
import { Users, Mail, ChevronRight, Plus } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const userGroups = ref([])
const counts = ref({})
const newGroupName = ref('')
const newGroupColor = ref('#f43f5e')
const inviteCode = ref('')
const loadingCreate = ref(false)
const loadingJoin = ref(false)
const joinError = ref('')
const welcomeMessages = [
  { prefix: 'Hey', subtitle: 'Manage your groups and events.' },
  { prefix: 'Welcome back', subtitle: 'Ready to plan today?' },
  { prefix: 'Great to see you', subtitle: 'Your groups are waiting.' },
  { prefix: 'Let’s get started', subtitle: 'Keep your schedule in sync.' },
  { prefix: 'Hello again', subtitle: 'Pick up where you left off.' },
]

const firstName = computed(() => authStore.user?.name?.split(' ')[0] || 'there')
const selectedWelcome = computed(() => {
  const now = new Date()
  const daySeed = Number(
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
  )
  const nameSeed = firstName.value.length
  const index = Math.abs(daySeed + nameSeed) % welcomeMessages.length
  return welcomeMessages[index]
})
const welcomePrefix = computed(() => selectedWelcome.value.prefix)
const welcomeSubtitle = computed(() => selectedWelcome.value.subtitle)

const stringToColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 90%, 55%)`
}

const loadGroups = async () => {
  if (!authStore.user) return
  try {
    await groupsStore.fetchAll()
    userGroups.value = groupsStore.items.map((g) => ({
      ...g,
      color: g.color || stringToColor(g.id),
    }))
    const countMap = {}
    for (const g of userGroups.value) countMap[g.id] = g.memberCount ?? 0
    counts.value = countMap
  } catch (err) {
    console.error('Failed to load groups:', err)
  }
}

const createGroup = async () => {
  loadingCreate.value = true
  joinError.value = ''
  try {
    await groupsStore.createGroup({
      name: newGroupName.value,
      color: newGroupColor.value || stringToColor(groupIdFallback()),
    })
    newGroupName.value = ''
    await loadGroups()
  } catch (err) {
    joinError.value = 'Failed to create group.'
    console.error(err)
  } finally {
    loadingCreate.value = false
  }
}

const groupIdFallback = () => `g${Math.random().toString(36).slice(2, 8)}`

const joinGroup = async () => {
  loadingJoin.value = true
  joinError.value = ''
  try {
    await groupService.joinByCode(inviteCode.value.toUpperCase())
    inviteCode.value = ''
    await loadGroups()
  } catch (err) {
    joinError.value = err?.code === 'not_found' ? 'Invalid invite code.' : 'Could not join group.'
    console.error(err)
  } finally {
    loadingJoin.value = false
  }
}

const colorToRgba = (color, alpha = 1) => {
  if (!color) return `rgba(244,63,94,${alpha})`
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (color.startsWith('hsl')) return color.replace('hsl', 'hsla').replace(')', `, ${alpha})`)
  return color
}

onMounted(async () => {
  await authStore.initAuth()
  await loadGroups()
})
</script>
