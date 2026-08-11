<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-y-auto">
    <div class="w-full max-w-full p-3 sm:p-4 md:max-w-7xl md:mx-auto space-y-3 sm:space-y-4">
      <!-- Group selector bar -->
      <div class="flex items-center gap-2">
        <UiSelect v-model="selectedGroupId" @update:model-value="changeGroup">
          <UiSelectTrigger
            class="w-full h-auto flex-1 rounded-2xl bg-rose-500 py-2.5 text-white border-transparent hover:bg-rose-600 focus-visible:ring-rose-300 data-placeholder:text-white/80 [&_svg]:text-white/80"
          >
            <UiSelectValue placeholder="Select a group..." />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem
              v-for="g in groupsStore.items"
              :key="g.$id"
              :value="g.$id"
            >
              {{ g.name }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
        <button
          @click="showCalendarIntegrations = true"
          class="touch-exempt flex-shrink-0 flex items-center justify-center w-10 h-10 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Calendar integrations"
        >
          <CalendarPlus class="w-4 h-4" />
        </button>
        <button
          @click="showInviteModal = true"
          class="touch-exempt flex-shrink-0 flex items-center justify-center w-10 h-10 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Share invite code"
        >
          <Share2 class="w-4 h-4" />
        </button>
      </div>

      <CalendarView
        :events="eventsStore.items"
        :tags="tagsStore.items"
        :current-user-id="authStore.user.$id"
        :group-id="selectedGroupId"
        :week-starts-on="preferencesStore.weekStartsOn"
        :date-format="preferencesStore.dateFormat"
        :time-format="preferencesStore.timeFormat"
        @add-event="openAddEvent"
        @edit-event="handleEditEvent"
        @bulk-schedule="showBulkScheduleModal = true"
        @spin-schedule="showSpinScheduler = true"
        @event-moved="onEventMoved"
      />
    </div>

    <!-- Modals -->
    <InviteModal v-if="showInviteModal" :inviteCode="inviteCode" @close="showInviteModal = false" />
    <UiDialog :open="showCalendarIntegrations" @update:open="showCalendarIntegrations = false">
      <UiDialogContent class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle class="dark:text-white">Calendar Integrations</UiDialogTitle>
        </UiDialogHeader>

      <div class="space-y-4">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">
          No additional login needed in Baobun. This integration is a live personal feed.
        </p>

        <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">Live updates</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                Publishes only events for you + everyone, refreshed about every 30 minutes.
              </p>
            </div>
            <button
              type="button"
              class="touch-exempt rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="!selectedGroupId || liveFeedBusy || !liveFeedBucketId"
              @click="toggleLiveUpdates"
            >
              {{ liveFeedEnabledForGroup ? 'Disable' : 'Enable' }}
            </button>
          </div>

          <div v-if="!liveFeedBucketId" class="text-xs text-amber-600 dark:text-amber-400">
            Live feed bucket is not configured. Set <code>VITE_CALENDAR_FEEDS_BUCKET</code> to enable subscriptions.
          </div>

          <div v-else-if="liveFeedEnabledForGroup" class="space-y-2">
            <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">Subscription URL (webcal)</label>
            <div class="flex items-center gap-2">
              <input
                :value="liveFeedWebcalUrl"
                readonly
                class="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-2 text-xs text-neutral-700 dark:text-neutral-200"
              />
              <button
                type="button"
                class="touch-exempt rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                @click="copyText(liveFeedWebcalUrl)"
              >
                Copy
              </button>
            </div>
            <div class="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>
                Last sync: {{ liveFeedLastSyncedLabel }}
              </span>
              <button
                type="button"
                class="touch-exempt inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="liveFeedBusy"
                @click="refreshLiveFeedNow"
              >
                <Link class="w-3.5 h-3.5" />
                Sync now
              </button>
            </div>
          </div>

          <p v-if="liveFeedError" class="text-xs text-red-500">
            {{ liveFeedError }}
          </p>
        </div>
      </div>
      </UiDialogContent>
    </UiDialog>
    <EventModal
      v-if="showEventModal"
      :visible="showEventModal"
      :groupId="selectedGroupId"
      :event="selectedEvent"
      :defaultDate="preselectedDate"
      @close="showEventModal = false"
      @event-added="reloadEvents"
      @event-updated="reloadEvents"
    />
    <BulkSchedule
      v-if="showBulkScheduleModal"
      @close="showBulkScheduleModal = false"
      @bulk-schedule="handleBulkSchedule"
      :groupId="selectedGroupId"
    />
    <SpinScheduler
      v-model="showSpinScheduler"
      :groupId="selectedGroupId"
      :tags="tagsStore.items"
      @done="reloadEvents"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CalendarView from '@/components/Calendar.vue'
import InviteModal from '@/components/InviteModal.vue'
import EventModal from '@/components/EventModal.vue'
import BulkSchedule from '@/components/BulkSchedule.vue'
import SpinScheduler from '@/components/SpinScheduler.vue'

import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import { useEventsStore } from '@/stores/event'
import { useTagsStore } from '@/stores/tag'
import { usePreferencesStore } from '@/stores/preferences'
import { useNotificationsStore } from '@/stores/notifications'
import { useCalendarFeedStore } from '@/stores/calendarFeed'
import {
  scheduleEventNotifications,
  clearScheduledEventNotifications,
} from '@/composable/useEventNotifications'
import {
  getLiveFeedBucketId,
  getLiveFeedUrls,
  publishLiveCalendarFeed,
} from '@/lib/liveCalendarFeed'
import { CalendarPlus, Link, Share2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const groupsStore = useGroupsStore()
const eventsStore = useEventsStore()
const tagsStore = useTagsStore()
const preferencesStore = usePreferencesStore()
const notificationsStore = useNotificationsStore()
const calendarFeedStore = useCalendarFeedStore()

const selectedGroupId = ref(route.params.id || '')

const showInviteModal = ref(false)
const showCalendarIntegrations = ref(false)
const liveFeedBusy = ref(false)
const liveFeedError = ref('')
const liveFeedDirty = ref(false)
const liveSyncIntervalId = ref(null)
const preselectedDate = ref(null)
const showEventModal = ref(false)
const selectedEvent = ref(null)
const showBulkScheduleModal = ref(false)
const showSpinScheduler = ref(false)
const LIVE_FEED_REPUBLISH_MS = 30 * 60 * 1000
const groupMembers = ref([])

/** Fetch helpers */
const refreshGroups = async () => {
  await groupsStore.fetchAll()
}

const refreshEvents = async () => {
  if (!selectedGroupId.value) return
  await eventsStore.fetchByGroup(selectedGroupId.value)
  scheduleReminders()
}
const reloadEvents = refreshEvents

const refreshTags = async () => {
  if (!selectedGroupId.value) return
  await tagsStore.fetchByGroup(selectedGroupId.value)
}

const refreshMembers = async () => {
  if (!selectedGroupId.value) return
  groupMembers.value = await groupsStore.getMembers(selectedGroupId.value, authStore.user)
}

/** Handle group changes from the selector */
const changeGroup = async () => {
  const id = selectedGroupId.value
  if (!id) return
  router.push({ params: { id } }) // keep route in sync
  await Promise.all([refreshEvents(), refreshTags(), refreshMembers()])
}

/** Optional: keep in sync if user navigates via URL */
watch(
  () => route.params.id,
  async (id) => {
    if (typeof id === 'string' && id !== selectedGroupId.value) {
      selectedGroupId.value = id
      await changeGroup()
    }
  },
)

const handleEditEvent = (event) => {
  selectedEvent.value = event
  showEventModal.value = true
}

/** Calendar drag-move handler */
const onEventMoved = async ({ event, newStart }) => {
  const newStartDate = new Date(newStart)
  const patch = { start: newStartDate.toISOString() }

  const oldStart = new Date(event.start).getTime()
  const oldEnd = new Date(event.end).getTime()
  if (Number.isFinite(oldStart) && Number.isFinite(oldEnd) && oldEnd > oldStart) {
    const duration = oldEnd - oldStart
    patch.end = new Date(newStartDate.getTime() + duration).toISOString()
  } else {
    patch.end = new Date(newStartDate.getTime() + 60 * 60 * 1000).toISOString()
  }

  await eventsStore.updateEvent(event.$id, patch)
}

/** Bulk schedule callback */
const handleBulkSchedule = () => {
  showBulkScheduleModal.value = false
  reloadEvents()
}

/** Initial load */
onMounted(async () => {
  await refreshGroups()
  if (!selectedGroupId.value && groupsStore.items.length) {
    selectedGroupId.value = groupsStore.items[0].$id
  }
  await changeGroup()

  // Listen for the mobile FAB "add event" action from Navigator
  window.addEventListener('baobun:add-event', openAddEvent)
})

onUnmounted(() => {
  window.removeEventListener('baobun:add-event', openAddEvent)
  clearScheduledEventNotifications()
  if (liveSyncIntervalId.value) clearInterval(liveSyncIntervalId.value)
})

const openAddEvent = (dateOrEvent) => {
  selectedEvent.value = null
  // dateOrEvent could be a Date (from calendar click) or a CustomEvent (from FAB)
  preselectedDate.value = dateOrEvent instanceof Date ? dateOrEvent : new Date()
  showEventModal.value = true
}

const inviteCode = computed(() => {
  const group = groupsStore.byId[selectedGroupId.value]
  return group?.inviteCode || ''
})

const selectedGroupName = computed(() => {
  const group = groupsStore.byId[selectedGroupId.value]
  return group?.name || 'Group'
})

const sortedEvents = computed(() =>
  [...(eventsStore.items || [])]
    .filter((event) => !!event?.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start)),
)

const liveFeedBucketId = getLiveFeedBucketId()
const liveFeedScopeKey = computed(() =>
  selectedGroupId.value && authStore.user?.$id
    ? `${selectedGroupId.value}:${authStore.user.$id}`
    : selectedGroupId.value,
)
const liveFeedEnabledForGroup = computed(() =>
  calendarFeedStore.isEnabledForGroup(liveFeedScopeKey.value),
)
const normalizePeopleIds = (people) => {
  if (!Array.isArray(people)) return []
  return people
    .map((person) => (typeof person === 'string' ? person : person?.$id || ''))
    .filter(Boolean)
}
const currentUserIdentitySet = computed(() => {
  const ids = new Set()
  if (authStore.user?.$id) ids.add(authStore.user.$id)
  if (authStore.user?.email) ids.add(authStore.user.email)

  for (const member of groupMembers.value || []) {
    if (!member) continue
    // people[] can contain membership doc ids or raw user ids depending on creator flow/version.
    if (member.userId && member.userId === authStore.user?.$id && member.$id) ids.add(member.$id)
    if (member.userId) ids.add(member.userId)
    if (member.email) ids.add(member.email)
  }

  return ids
})
const liveFeedEvents = computed(() =>
  sortedEvents.value.filter((event) => {
    const people = normalizePeopleIds(event.people)
    if (!authStore.user?.$id) return true
    if (!people.length) return event.userId === authStore.user.$id
    if (people.includes('everyone')) return true
    return people.some((personId) => currentUserIdentitySet.value.has(personId))
  }),
)
const liveFeedUrls = ref({ httpsUrl: '', webcalUrl: '' })
const refreshLiveFeedUrls = async () => {
  if (!selectedGroupId.value || !liveFeedEnabledForGroup.value) {
    liveFeedUrls.value = { httpsUrl: '', webcalUrl: '' }
    return
  }
  liveFeedUrls.value = await getLiveFeedUrls({
    groupId: selectedGroupId.value,
    userId: authStore.user?.$id,
  })
}
const liveFeedWebcalUrl = computed(() => liveFeedUrls.value.webcalUrl || '')
const liveFeedLastSyncedLabel = computed(() => {
  const last = calendarFeedStore.lastSyncedAtByGroup[liveFeedScopeKey.value]
  if (!last) return 'Never'
  const date = new Date(last)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString()
})
const liveFeedSignature = computed(() =>
  liveFeedEvents.value
    .map((event) =>
      [
        event.$id,
        event.start,
        event.end,
        event.title,
        event.notes,
        event.tagId,
        Array.isArray(event.people)
          ? event.people
              .map((person) => (typeof person === 'string' ? person : person?.$id || ''))
              .filter(Boolean)
              .join(',')
          : '',
      ].join(':'),
    )
    .join('|'),
)
const tagNameById = computed(() => {
  const map = {}
  for (const tag of tagsStore.items || []) {
    if (tag?.$id) map[tag.$id] = tag.name || 'General'
  }
  return map
})
const memberNameById = computed(() => {
  const map = { everyone: 'Everyone' }
  for (const member of groupMembers.value || []) {
    if (member?.$id) map[member.$id] = member.name || member.email || member.$id
  }
  return map
})

const copyText = async (value) => {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // no-op
  }
}

const syncLiveFeed = async ({ force = false } = {}) => {
  if (!selectedGroupId.value || !liveFeedBucketId) return
  if (!liveFeedEnabledForGroup.value) return
  if (!force && !liveFeedDirty.value) return
  if (!force && calendarFeedStore.lastSignatureByGroup[liveFeedScopeKey.value] === liveFeedSignature.value) {
    liveFeedDirty.value = false
    return
  }

  liveFeedBusy.value = true
  liveFeedError.value = ''
  try {
    const result = await publishLiveCalendarFeed({
      groupId: selectedGroupId.value,
      userId: authStore.user?.$id,
      groupName: selectedGroupName.value,
      events: liveFeedEvents.value,
      tagNameById: tagNameById.value,
      memberNameById: memberNameById.value,
    })
    if (result?.webcalUrl) liveFeedUrls.value = result
    calendarFeedStore.setSyncedMetadata({
      groupId: liveFeedScopeKey.value,
      syncedAt: new Date().toISOString(),
      signature: liveFeedSignature.value,
    })
    liveFeedDirty.value = false
  } catch (error) {
    liveFeedError.value = error?.message || 'Could not sync live calendar feed.'
  } finally {
    liveFeedBusy.value = false
  }
}

const setLiveFeedDirty = () => {
  if (!selectedGroupId.value || !liveFeedEnabledForGroup.value) return
  liveFeedDirty.value = true
}

const stopLiveRepublishLoop = () => {
  if (!liveSyncIntervalId.value) return
  clearInterval(liveSyncIntervalId.value)
  liveSyncIntervalId.value = null
}

const startLiveRepublishLoop = () => {
  stopLiveRepublishLoop()
  if (!selectedGroupId.value || !liveFeedEnabledForGroup.value || !liveFeedBucketId) return

  liveSyncIntervalId.value = window.setInterval(() => {
    syncLiveFeed()
  }, LIVE_FEED_REPUBLISH_MS)
}

const toggleLiveUpdates = async () => {
  if (!selectedGroupId.value || !liveFeedBucketId || liveFeedBusy.value) return

  if (liveFeedEnabledForGroup.value) {
    calendarFeedStore.setEnabledForGroup(liveFeedScopeKey.value, false)
    liveFeedDirty.value = false
    stopLiveRepublishLoop()
    liveFeedUrls.value = { httpsUrl: '', webcalUrl: '' }
    return
  }

  calendarFeedStore.setEnabledForGroup(liveFeedScopeKey.value, true)
  startLiveRepublishLoop()
  await syncLiveFeed({ force: true })
  await refreshLiveFeedUrls()
}

const refreshLiveFeedNow = async () => {
  await syncLiveFeed({ force: true })
}

const scheduleReminders = () => {
  scheduleEventNotifications({
    events: eventsStore.items,
    groupId: selectedGroupId.value,
    enabled: notificationsStore.enabled,
    permission: notificationsStore.permission,
    leadMinutes: notificationsStore.leadMinutes,
    dateFormat: preferencesStore.dateFormat,
    timeFormat: preferencesStore.timeFormat,
  })
}

watch(
  () => [
    selectedGroupId.value,
    notificationsStore.enabled,
    notificationsStore.permission,
    notificationsStore.leadMinutes,
    preferencesStore.dateFormat,
    preferencesStore.timeFormat,
    eventsStore.items.map((e) => `${e.$id}:${e.start}`).join('|'),
  ],
  () => {
    scheduleReminders()
  },
  { immediate: true },
)

watch(
  () => [selectedGroupId.value, liveFeedEnabledForGroup.value, liveFeedSignature.value],
  () => {
    setLiveFeedDirty()
  },
)

watch(
  () => [selectedGroupId.value, liveFeedEnabledForGroup.value],
  () => {
    if (!liveFeedEnabledForGroup.value) {
      stopLiveRepublishLoop()
      liveFeedDirty.value = false
      return
    }
    setLiveFeedDirty()
    startLiveRepublishLoop()
    refreshLiveFeedUrls()
  },
  { immediate: true },
)
</script>
