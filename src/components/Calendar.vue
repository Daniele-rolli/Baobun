<template>
  <div class="flex w-full min-w-0 items-start gap-4">
    <!-- Main Calendar Area -->
    <div class="flex-1 min-w-0 space-y-4">
      <div
        ref="calendarEl"
        class="bg-card border rounded-2xl overflow-hidden touch-pan-y"
      >
        <!-- Toolbar -->
        <div
          class="px-3 py-2 flex items-center justify-between gap-2 border-b"
        >
          <!-- Left: title + view toggle -->
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="text-base font-semibold truncate">{{ headerTitle }}</h3>
            <div
              class="flex rounded-lg overflow-hidden border text-xs flex-shrink-0"
            >
              <button
                class="touch-exempt px-2.5 py-1 font-medium transition-colors"
                :class="
                  viewMode === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                "
                @click="viewMode = 'month'"
              >
                Mo
              </button>
              <button
                class="touch-exempt px-2.5 py-1 font-medium transition-colors"
                :class="
                  viewMode === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                "
                @click="viewMode = 'week'"
              >
                Wk
              </button>
            </div>
          </div>

          <!-- Right: nav + actions -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- Prev/Next -->
            <div
              class="flex items-center border rounded-xl overflow-hidden bg-card"
            >
              <button
                class="touch-exempt px-2 py-1 hover:bg-muted transition-colors"
                @click="prev"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <div class="w-px h-4 bg-border"></div>
              <button
                class="touch-exempt px-2 py-1 hover:bg-muted transition-colors"
                @click="next"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>

            <!-- Bulk + Spin (desktop only) -->
            <div
              v-if="canEdit"
              class="hidden sm:flex items-center border rounded-xl overflow-hidden bg-card"
            >
              <button
                class="touch-exempt px-2 py-1 hover:bg-muted transition-colors"
                title="Bulk Schedule"
                @click="$emit('bulk-schedule')"
              >
                <calendar-check class="w-4 h-4" />
              </button>
              <div class="w-px h-4 bg-border"></div>
              <button
                class="touch-exempt px-2 py-1 hover:bg-muted transition-colors"
                title="Spin Scheduler"
                @click="$emit('spin-schedule')"
              >
                <Shuffle class="w-4 h-4" />
              </button>
            </div>

            <!-- Add event -->
            <UiButton
              v-if="canEdit"
              size="icon"
              class="touch-exempt shadow-sm"
              @click="$emit('add-event', selectedDate)"
            >
              <Plus class="w-4 h-4" />
            </UiButton>
          </div>
        </div>

        <!-- Weekday Labels -->
        <div
          v-if="viewMode === 'month'"
          class="grid grid-cols-7 text-center text-[10px] sm:text-xs font-medium text-muted-foreground dark:text-muted-foreground border-b select-none"
        >
          <div v-for="(wd, i) in weekdayLabels" :key="i" class="py-1.5">
            <span class="sm:hidden">{{ wd[0] }}</span>
            <span class="hidden sm:inline">{{ wd.slice(0, 3) }}</span>
          </div>
        </div>

        <!-- Month View Grid -->
        <div v-if="viewMode === 'month'" class="grid grid-cols-7">
          <div
            v-for="day in daysInMonth"
            :key="day.date.getTime()"
            class="hidden sm:block min-h-14 md:min-h-24 overflow-y-auto border-r border-b p-1 text-xs transition-all hover:bg-muted"
            :class="{
              'bg-muted/50  text-muted-foreground': !day.currentMonth,
              'bg-muted/50 ': isToday(day.date),
              'bg-muted': isSelected(day.date),
            }"
            @click="selectDate(day.date)"
            @dragover.prevent
            @drop="onDrop(day.date, $event)"
          >
            <!-- Day Number -->
            <div class="font-medium mb-1 leading-none inline-flex items-center gap-2">
              <span
                class=""
                :class="{
                  'bg-foreground text-background w-fit p-1 px-1.5 rounded-full': isToday(day.date),
                  'bg-primary text-primary-foreground w-fit p-1 px-1.5 rounded-full': isSelected(day.date),
                }"
              >
                {{ day.day }}
              </span>
            </div>

            <!-- Events (desktop) -->
            <div class="hidden md:block">
              <div
                v-for="event in getEventsForDate(day.date)"
                :key="event.id"
                class="event-item mb-1 truncate rounded-lg px-2 py-1 text-xs text-auto cursor-move"
                :style="{ backgroundColor: getTagColor(event.tagId) }"
                :draggable="canEdit"
                @dragstart="onDragStart(event, $event)"
                @click.stop="$emit('edit-event', event)"
                title="Drag to move • Click to edit"
              >
                {{ event.title }}
              </div>

              <div v-if="getEventsForDate(day.date).length === 0" class="h-1"></div>
            </div>
          </div>
        </div>

        <!-- Month Grid (mobile) -->
        <div v-if="viewMode === 'month'" class="grid grid-cols-7 sm:hidden">
          <div
            v-for="day in daysInMonth"
            :key="day.date.getTime()"
            class="flex flex-col items-center justify-start bg-card py-4 cursor-pointer hover:bg-muted/50 /80 border-b"
            :class="{
              'text-muted-foreground': !day.currentMonth,
            }"
            @click="selectDate(day.date)"
          >
            <div
              class="text-xl font-semibold flex items-center justify-center w-10 h-10 rounded-full"
              :class="{
                'bg-primary text-primary-foreground': isToday(day.date),
                'bg-primary text-primary-foreground': isSelected(day.date),
              }"
            >
              {{ day.day }}
            </div>

            <div class="flex items-center justify-center mt-2 space-x-1">
              <span
                v-for="event in getEventsForDate(day.date)"
                :key="event.id"
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: getTagColor(event.tagId) }"
              ></span>
            </div>
          </div>
        </div>

        <!-- iOS-style Week View Grid -->
        <div v-if="viewMode === 'week'" class="bg-card">
          <!-- Time Column + Day Columns Header -->
          <div class="grid grid-cols-8 border-b border-t">
            <!-- Empty corner for time column -->
            <div class="border-r p-2"></div>
            <!-- Day headers -->
            <div
              v-for="day in daysInWeek"
              :key="day.getTime()"
              class="text-center p-2 border-r last:border-r-0"
            >
              <div class="text-xs text-muted-foreground uppercase tracking-wide">
                {{ weekdayLabelsByIndex[day.getDay()].slice(0, 3) }}
              </div>
              <div
                class="text-lg font-semibold mt-1"
                :class="{
                  'bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto':
                    isToday(day),
                  'bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto':
                    isSelected(day),
                }"
                @click="selectDate(day)"
              >
                {{ day.getDate() }}
              </div>
            </div>
          </div>

          <!-- Time slots grid -->
          <div class="grid grid-cols-8 h-96 overflow-y-auto">
            <!-- Time column -->
            <div class="border-r">
              <div
                v-for="hour in timeSlots"
                :key="hour"
                class="h-12 border-b p-1 text-xs text-muted-foreground text-right pr-2"
              >
                <div class="relative">{{ formatHour(hour) }}</div>
              </div>
            </div>

            <!-- Day columns -->
            <div
              v-for="day in daysInWeek"
              :key="day.getTime()"
              class="relative border-r last:border-r-0"
              :class="{
                'ring-2 ring-rose-600 ring-inset': isSelected(day),
              }"
              @click="selectDate(day)"
              @dragover.prevent
              @drop="onDrop(day, $event)"
            >
              <!-- Hour lines -->
              <div
                v-for="hour in timeSlots"
                :key="hour"
                class="h-12 border-b"
              ></div>

              <!-- Events positioned absolutely -->
              <div
                v-for="segment in getVisibleWeekSegmentsForDate(day)"
                :key="`${segment.event.id}-${day.getTime()}`"
                class="absolute left-1 right-1 rounded-md text-xs cursor-move shadow-sm px-2 py-1 z-10"
                :style="{
                  backgroundColor: getTagColor(segment.event.tagId),
                  top: calculateEventTop(segment.start) + 'px',
                  height: calculateEventHeight(segment.start, segment.end) + 'px',
                }"
                :draggable="canEdit"
                @dragstart="onDragStart(segment.event, $event)"
                @click.stop="$emit('edit-event', segment.event)"
                title="Drag to move • Click to edit"
              >
                <div class="font-medium truncate">{{ segment.event.title }}</div>
                <div class="text-xs opacity-75 truncate">
                  {{ formatEventTime(segment.start, segment.end) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="bg-card border rounded-2xl p-4 lg:hidden"
      >
        <UpcomingEvents
          :events="events"
          :tags="tags"
          :group-id="groupId"
          :current-user-id="currentUserId"
          :selected-date="selectedDate"
          @event-clicked="$emit('edit-event', $event)"
        />
      </div>
    </div>
    <!-- Right Sidebar (Desktop) -->
    <div v-if="showDesktopSidebar" class="hidden lg:block w-72 xl:w-80 flex-shrink-0">
      <UiCard class="sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden p-4">
        <UpcomingEvents
          :events="events"
          :tags="tags"
          :group-id="groupId"
          :current-user-id="currentUserId"
          :selected-date="selectedDate"
          compact
          @event-clicked="$emit('edit-event', $event)"
        />
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import UpcomingEvents from './UpcomingEvents.vue'
import { useSwipe } from '@/composable/useSwipe'
import {
  WEEKDAY_LABELS_SHORT,
  rotateWeekdayLabels,
  formatDateNumeric,
  formatDateShort,
  formatMonthYear,
  formatTime,
  formatHourLabel,
} from '@/lib/dateTimePreferences'
import {
  eventEndsOnOrAfterDate,
  eventOccursOnDate,
  getEventSegmentForDate,
} from '@/lib/eventDateRange'
import { ChevronLeft, ChevronRight, Plus, CalendarCheck, Shuffle } from 'lucide-vue-next'

const props = defineProps({
  events: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  currentUserId: { type: String, required: true },
  groupId: { type: String, required: true },
  weekStartsOn: { type: Number, default: 0 },
  dateFormat: { type: String, default: 'mdy' },
  timeFormat: { type: String, default: '12h' },
  canEdit: { type: Boolean, default: true },
})
const emit = defineEmits([
  'add-event',
  'edit-event',
  'event-moved',
  'bulk-schedule',
  'spin-schedule',
])
const today = new Date()
const month = ref(today.getMonth())
const year = ref(today.getFullYear())
const groupId = ref(props.groupId)
const calendarEl = ref(null)

const viewMode = ref('month') // 'month' | 'week'
const selectedDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

// Time slots for week view (6 AM to 10 PM)
const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6)

const normalizeCalendarDate = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const setCalendarDate = (date) => {
  const normalized = normalizeCalendarDate(date)
  selectedDate.value = normalized
  month.value = normalized.getMonth()
  year.value = normalized.getFullYear()
}

const shiftCalendarDateByDays = (days) => {
  const nextDate = new Date(selectedDate.value)
  nextDate.setDate(nextDate.getDate() + days)
  setCalendarDate(nextDate)
}

const shiftCalendarMonth = (months) => {
  const targetMonthDate = new Date(year.value, month.value + months, 1)
  const selectedDay = selectedDate.value.getDate()
  const daysInTargetMonth = new Date(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth() + 1,
    0,
  ).getDate()
  targetMonthDate.setDate(Math.min(selectedDay, daysInTargetMonth))
  setCalendarDate(targetMonthDate)
}

const tagsMap = computed(() => {
  const map = {}
  ;(props.tags || []).forEach((tag) => {
    if (tag && tag.id) map[tag.id] = tag
  })
  return map
})

function normalizeTagId(tagId) {
  if (Array.isArray(tagId)) return tagId[0]
  if (typeof tagId === 'object' && tagId?.id) return tagId.id
  return tagId
}

const hexToRgba = (hex, alpha = 0.5) => {
  if (!hex) return `rgba(107,114,128,${alpha})` // fallback gray
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

const getTagColor = (tagId, alpha = 0.3) => {
  const id = normalizeTagId(tagId)
  const tag = tagsMap.value[id] // reactive access
  const hex = tag?.color || '#6B7280'
  return hexToRgba(hex, alpha)
}

const headerTitle = computed(() => {
  if (viewMode.value === 'week') {
    const start = startOfWeek(selectedDate.value)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    if (props.dateFormat === 'ymd') {
      return `${formatDateNumeric(start, 'ymd')} – ${formatDateNumeric(end, 'ymd')}`
    }
    const startLabel = formatDateShort(start, props.dateFormat, false)
    const endLabel = formatDateShort(end, props.dateFormat, false)
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()
    return `${startLabel} – ${endLabel}, ${startYear === endYear ? startYear : `${startYear} / ${endYear}`}`
  }
  return formatMonthYear(new Date(year.value, month.value), props.dateFormat)
})

const weekdayLabelsByIndex = WEEKDAY_LABELS_SHORT
const weekdayLabels = computed(() => rotateWeekdayLabels(props.weekStartsOn))
const showDesktopSidebar = computed(() => {
  if (!(props.events || []).length) return false
  const from = new Date(selectedDate.value)
  from.setHours(0, 0, 0, 0)
  return props.events.some((event) => eventEndsOnOrAfterDate(event, from))
})

const daysInMonth = computed(() => {
  const date = new Date(year.value, month.value, 1)
  const days = []
  const firstDay = date.getDay()
  const leadingDays = (firstDay - props.weekStartsOn + 7) % 7

  // Previous month filler
  const prevMonth = new Date(year.value, month.value - 1)
  const daysInPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate()
  for (let i = leadingDays - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    days.push({
      day: d,
      date: new Date(year.value, month.value - 1, d),
      currentMonth: false,
    })
  }

  // Current month
  const daysInThisMonth = new Date(year.value, month.value + 1, 0).getDate()
  for (let i = 1; i <= daysInThisMonth; i++) {
    days.push({ day: i, date: new Date(year.value, month.value, i), currentMonth: true })
  }

  // Next month filler to 6 weeks
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, date: new Date(year.value, month.value + 1, i), currentMonth: false })
  }

  return days
})

const startOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day - props.weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const daysInWeek = computed(() => {
  const start = startOfWeek(selectedDate.value)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
})

const getEventsForDate = (date) => {
  return props.events
    .filter((event) => eventOccursOnDate(event, date))
    .sort((a, b) => a.start.localeCompare(b.start))
}

const getEventSegmentsForDate = (date) =>
  getEventsForDate(date)
    .map((event) => {
      const segment = getEventSegmentForDate(event, date)
      if (!segment) return null
      return { event, ...segment }
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start)

const getVisibleWeekSegmentsForDate = (date) => {
  const visibleStart = new Date(date)
  visibleStart.setHours(timeSlots[0], 0, 0, 0)

  const visibleEnd = new Date(date)
  visibleEnd.setHours(timeSlots[timeSlots.length - 1] + 1, 0, 0, 0)

  return getEventSegmentsForDate(date)
    .map((segment) => {
      const start = new Date(Math.max(segment.start.getTime(), visibleStart.getTime()))
      const end = new Date(Math.min(segment.end.getTime(), visibleEnd.getTime()))
      if (start >= end) return null
      return { ...segment, start, end }
    })
    .filter(Boolean)
}

const isToday = (date) => {
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

const isSelected = (date) => {
  return (
    date.getFullYear() === selectedDate.value.getFullYear() &&
    date.getMonth() === selectedDate.value.getMonth() &&
    date.getDate() === selectedDate.value.getDate()
  )
}

const selectDate = (date) => setCalendarDate(date)

const prev = () => {
  if (viewMode.value === 'week') {
    shiftCalendarDateByDays(-7)
  } else {
    shiftCalendarMonth(-1)
  }
}

const next = () => {
  if (viewMode.value === 'week') {
    shiftCalendarDateByDays(7)
  } else {
    shiftCalendarMonth(1)
  }
}

// Week view helper functions
const formatHour = (hour) => {
  return formatHourLabel(hour, props.timeFormat)
}

const calculateEventTop = (startTime) => {
  if (!startTime) return 0
  const time = new Date(startTime)
  const hour = time.getHours()
  const minute = time.getMinutes()

  // Each hour slot is 48px (h-12 = 3rem = 48px)
  // Find position relative to 6 AM start
  const hourFromStart = hour - 6
  if (hourFromStart < 0) return 0

  const pixelsPerHour = 48
  const pixelsPerMinute = pixelsPerHour / 60

  return hourFromStart * pixelsPerHour + minute * pixelsPerMinute
}

const calculateEventHeight = (startTime, endTime) => {
  if (!startTime || !endTime) return 48 // Default 1 hour

  const start = new Date(startTime)
  const end = new Date(endTime)
  const durationMs = end.getTime() - start.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)

  const pixelsPerHour = 48
  return Math.max(20, durationHours * pixelsPerHour) // Minimum 20px height
}

const formatEventTime = (startTime, endTime) => {
  if (!startTime) return ''

  const startStr = formatTime(startTime, props.timeFormat, true)

  if (!endTime) return startStr

  const endStr = formatTime(endTime, props.timeFormat, true)

  return `${startStr} - ${endStr}`
}

// --- Drag & Drop to move events between days (desktop) ---
const onDragStart = (eventObj, domEvent) => {
  if (!props.canEdit) return
  domEvent.dataTransfer.setData('text/plain', JSON.stringify({ id: eventObj.id }))
  domEvent.dataTransfer.effectAllowed = 'move'
}

const onDrop = (targetDate, domEvent) => {
  if (!props.canEdit) return
  try {
    const payload = JSON.parse(domEvent.dataTransfer.getData('text/plain'))
    const ev = props.events.find((e) => e.id === payload.id)
    if (!ev) return
    // Preserve local clock time and apply it to the dropped local date.
    // Avoids day-shift bugs caused by timezone-bearing ISO string slicing.
    const currentStart = new Date(ev.start)
    if (!Number.isFinite(currentStart.getTime())) return

    const newStartDate = new Date(targetDate)
    newStartDate.setHours(
      currentStart.getHours(),
      currentStart.getMinutes(),
      currentStart.getSeconds(),
      currentStart.getMilliseconds(),
    )

    const newStart = newStartDate.toISOString()
    emit('event-moved', { event: ev, newStart })
  } catch {
    // ignore
  }
}

// ── Touch swipe navigation ───────────────────────────────
const { attachSwipe } = useSwipe({
  onLeft: () => next(),
  onRight: () => prev(),
})

onMounted(() => {
  if (calendarEl.value) attachSwipe(calendarEl.value)
})
</script>
