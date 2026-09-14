<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="text-base font-semibold">
        {{ selectedDate ? 'Events from ' + formatDateShort(selectedDate) : 'Upcoming Events' }}
      </h3>
      <div class="flex items-center gap-2 flex-shrink-0">
        <UiButton
          v-if="matchingEvents.length && !selectionMode"
          type="button"
          variant="outline"
          size="sm"
          @click="selectionMode = true"
        >
          Select
        </UiButton>
        <UiButton
          v-if="selectionMode"
          type="button"
          variant="outline"
          size="sm"
          :disabled="!selectedEvents.length"
          @click="exportSelectedEvents"
        >
          <DownloadIcon class="w-3.5 h-3.5" />
          <span>Export{{ selectedEvents.length ? ` (${selectedEvents.length})` : '' }}</span>
        </UiButton>
        <UiButton
          v-if="selectionMode"
          type="button"
          variant="ghost"
          size="sm"
          @click="clearSelection"
        >
          Cancel
        </UiButton>
        <span class="text-xs text-muted-foreground tabular-nums">{{ matchingEvents.length }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 mb-3 w-full">
      <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <button
          v-for="member in members"
          :key="member.id"
          class="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
          :class="
            selectedUserIdLocal === member.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground hover:border-primary'
          "
          @click="selectedUserIdLocal = member.id"
        >
          <img
            v-if="member.avatarUrl && member.id !== 'everyone'"
            :src="member.avatarUrl"
            :alt="member.name"
            class="w-4 h-4 rounded-full object-cover"
          />
          <span>{{ member.name }}</span>
        </button>
      </div>

      <div v-if="!compact" class="relative">
        <SearchIcon
          class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
        />
        <UiInput
          v-model="search"
          placeholder="Search events..."
          class="pl-9"
        />
      </div>
    </div>

    <div
      v-if="filteredEvents.length"
      class="space-y-1.5 overflow-y-auto overscroll-contain pr-0.5"
      :style="eventListStyle"
    >
      <button
        v-for="event in filteredEvents"
        :key="event.id"
        class="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left transition-all active:scale-[0.98]"
        :class="{
          'ring-2 ring-primary ring-inset': selectionMode && isEventSelected(event.id),
        }"
        :style="{ background: getTagColor(event.tagId) }"
        @click="handleEventClick(event)"
      >
        <div
          v-if="selectionMode"
          class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold"
          :class="
            isEventSelected(event.id)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-transparent'
          "
        >
          <CheckIcon class="h-4 w-4" />
        </div>

        <div class="flex-shrink-0">
          <img
            v-if="
              tagsMap[normalizeTagId(event.tagId)]?.imageId &&
              !brokenIcons.has(normalizeTagId(event.tagId))
            "
            :src="getTagIconUrl(tagsMap[normalizeTagId(event.tagId)].imageId)"
            alt="tag icon"
            class="w-10 h-10 rounded-xl object-cover"
            referrerpolicy="no-referrer"
            @error="brokenIcons.add(normalizeTagId(event.tagId))"
          />
          <div
            v-else
            class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
            :style="{ backgroundColor: tagsMap[normalizeTagId(event.tagId)]?.color || '#e5e7eb' }"
          >
            {{ getTagLabel(event.tagId).charAt(0) }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">{{ event.title }}</div>
          <div class="text-xs mt-0.5 text-muted-foreground">
            {{ formatEventDateRange(event) }} · {{ getTagLabel(event.tagId) }}
          </div>
        </div>

        <ChevronRightIcon v-if="!selectionMode" class="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <CalendarIcon class="w-8 h-8 mb-2 opacity-50" />
      <p class="text-sm">No events found</p>
      <UiButton
        v-if="selectedUserIdLocal !== 'everyone' || search"
        variant="link"
        size="sm"
        @click="clearFilters"
      >
        Clear filters
      </UiButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useGroupsStore } from '@/stores/group'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import {
  formatDateShort as formatDateShortByPreference,
  formatTime,
} from '@/lib/dateTimePreferences'
import { eventEndsOnOrAfterDate, eventSpansMultipleDates } from '@/lib/eventDateRange'
import { buildEventsCsvFileName, downloadEventsCsv } from '@/lib/exportEventsCsv'

// Lucide Imports
import {
  CheckIcon,
  SearchIcon,
  ChevronRightIcon,
  CalendarIcon,
  DownloadIcon,
} from 'lucide-vue-next'

const props = defineProps({
  events: { type: Array, required: true },
  tags: { type: Array, required: true },
  currentUserId: { type: String, default: null },
  selectedDate: { type: [Date, String], default: null },
  groupId: { type: String, required: true },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['event-clicked', 'update:selectedUserId'])
const authStore = useAuthStore()
const groupStore = useGroupsStore()
const preferencesStore = usePreferencesStore()

const search = ref('')
const selectedUserIdLocal = ref('everyone')
const selectionMode = ref(false)
const selectedEventIds = ref([])
const members = ref([])
const brokenIcons = reactive(new Set())

onMounted(async () => {
  const fetchedMembers = await groupStore.getMembers(props.groupId, authStore.user)
  members.value = [
    {
      id: 'everyone',
      name: 'Everyone',
      avatarUrl: null,
    },
    ...fetchedMembers,
  ]
})

const tagsMap = computed(() => {
  return props.tags.reduce((map, tag) => {
    map[tag.id] = tag
    return map
  }, {})
})

const normalizePeopleIds = (people) => {
  if (!Array.isArray(people)) return []
  return people
    .map((person) => {
      if (typeof person === 'string') return person
      if (person?.id) return person.id
      return ''
    })
    .filter(Boolean)
}

const matchingEvents = computed(() => {
  let result = [...props.events].sort((a, b) => new Date(a.start) - new Date(b.start))

  if (props.selectedDate) {
    const selectedDateObj = new Date(props.selectedDate)
    selectedDateObj.setHours(0, 0, 0, 0)
    result = result.filter((event) => eventEndsOnOrAfterDate(event, selectedDateObj))
  }

  if (selectedUserIdLocal.value && selectedUserIdLocal.value !== 'everyone') {
    result = result.filter((e) => {
      const people = normalizePeopleIds(e.people)
      if (people.includes('everyone')) return true
      if (people.includes(selectedUserIdLocal.value)) return true
      return !people.length && e.userId === selectedUserIdLocal.value
    })
  }

  if (search.value.trim()) {
    const term = search.value.toLowerCase()
    result = result.filter((e) => e.title.toLowerCase().includes(term))
  }

  return result
})

const filteredEvents = computed(() => matchingEvents.value.slice(0, props.compact ? 20 : 50))

const eventListStyle = computed(() =>
  props.compact ? 'max-height: min(72vh, 38rem)' : 'max-height: min(60vh, 32rem)',
)

watch(selectedUserIdLocal, (val) => emit('update:selectedUserId', val))

const clearFilters = () => {
  selectedUserIdLocal.value = 'everyone'
  search.value = ''
}

const selectedEvents = computed(() =>
  filteredEvents.value.filter((event) => selectedEventIds.value.includes(event.id)),
)

const isEventSelected = (eventId) => selectedEventIds.value.includes(eventId)

const toggleEventSelection = (eventId) => {
  if (isEventSelected(eventId)) {
    selectedEventIds.value = selectedEventIds.value.filter((id) => id !== eventId)
    return
  }
  selectedEventIds.value = [...selectedEventIds.value, eventId]
}

const clearSelection = () => {
  selectionMode.value = false
  selectedEventIds.value = []
}

const exportSelectedEvents = () => {
  downloadEventsCsv({
    events: selectedEvents.value,
    members: members.value,
    filename: buildEventsCsvFileName(props.selectedDate ? 'events-from-selected-date' : 'events'),
    dateFormat: preferencesStore.dateFormat,
  })
  clearSelection()
}

const handleEventClick = (event) => {
  if (selectionMode.value) {
    toggleEventSelection(event.id)
    return
  }
  emit('event-clicked', event)
}

const normalizeTagId = (tagId) => {
  if (Array.isArray(tagId)) return tagId[0]
  if (typeof tagId === 'object' && tagId?.id) return tagId.id
  return tagId
}

const getTagLabel = (tagId) => {
  const id = normalizeTagId(tagId)
  return tagsMap.value[id]?.name || 'General'
}

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(107,114,128,${alpha})`
  let c = hex.replace('#', '')
  if (c.length === 3)
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getTagColor = (tagId) => {
  const id = normalizeTagId(tagId)
  const hex = tagsMap.value[id]?.color || '#6B7280'
  return hexToRgba(hex, 0.15)
}

const getTagIconUrl = (imageId) => {
  const tag = Object.values(tagsMap.value).find((t) => t.imageId === imageId)
  return tag?.imageUrl || ''
}

const formatDate = (iso) => {
  const datePart = formatDateShortByPreference(iso, preferencesStore.dateFormat, true)
  const timePart = formatTime(iso, preferencesStore.timeFormat, true)
  return `${datePart} ${timePart}`.trim()
}

const formatEventDateRange = (event) => {
  if (!event?.start) return ''
  if (!eventSpansMultipleDates(event)) return formatDate(event.start)
  return `${formatDate(event.start)} -> ${formatDate(event.end)}`
}

const formatDateShort = (date) =>
  formatDateShortByPreference(date, preferencesStore.dateFormat, false)
</script>
