<template>
  <div class="min-h-screen">
    <div class="p-4 sm:p-6 overflow-y-auto">
      <div class="max-w-4xl mx-auto space-y-5">
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
            <h2 class="text-xl sm:text-2xl font-bold leading-tight">
              {{ daypart }}, <span class="text-primary">{{ firstName }}!</span>
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ groupsLine }}
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
              class="group flex items-center gap-3 p-4 text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm active:scale-[0.99] transition-all"
            >
              <div
                class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm"
                :style="{ backgroundColor: colorToRgba(group.color, 0.15), color: group.color }"
              >
                {{ group.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm truncate">
                  {{ group.name }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ counts[group.id] || 0 }} member{{ counts[group.id] !== 1 ? 's' : '' }}
                </p>
              </div>
              <ChevronRight
                class="w-4 h-4 text-muted-foreground/60 flex-shrink-0"
              />
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
                  placeholder="Enter code (e.g. ABC123)"
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import * as groupService from '@/lib/services/groups'
import { Users, Mail, ChevronRight, Plus, LoaderCircle } from 'lucide-vue-next'

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
