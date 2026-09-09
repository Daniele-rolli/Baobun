<template>
  <UiDialog :open="modelValue" @update:open="$emit('update:modelValue', false)">
    <UiDialogContent class="sm:max-w-2xl">
      <div class="space-y-6 p-1">
        <!-- Header -->
        <UiDialogHeader class="flex-row items-start justify-between text-left">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"
            >
              <Shuffle class="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <UiDialogTitle class="text-lg font-bold">Spin Scheduler</UiDialogTitle>
              <p class="text-xs text-neutral-500">
                Auto-assign groups to dates by spinning the wheel
              </p>
            </div>
          </div>
          <button
            @click="$emit('update:modelValue', false)"
            class="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X class="w-5 h-5" />
          </button>
        </UiDialogHeader>

        <!-- Step indicator -->
        <div class="flex items-center gap-2">
          <div v-for="(step, i) in steps" :key="i" class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors"
              :class="
                currentStep === i
                  ? 'bg-rose-600 text-white'
                  : currentStep > i
                    ? 'bg-green-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
              "
            >
              <Check v-if="currentStep > i" class="w-3.5 h-3.5" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-xs text-neutral-500 hidden sm:block">{{ step }}</span>
            <div v-if="i < steps.length - 1" class="w-8 h-px bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>

        <!-- ─── STEP 0: Enter Groups ─── -->
        <div v-if="currentStep === 0" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5"
              >Groups <span class="text-neutral-400">(one per line or comma-separated)</span></label
            >
            <textarea
              v-model="groupsRaw"
              class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none placeholder-neutral-400 min-h-[120px]"
              placeholder="Team Alpha&#10;Team Beta&#10;Team Gamma"
            />
            <p class="text-xs text-neutral-400 mt-1">
              {{ parsedGroups.length }} group{{ parsedGroups.length !== 1 ? 's' : '' }} detected
            </p>
          </div>

          <!-- Preview chips -->
          <div v-if="parsedGroups.length" class="flex flex-wrap gap-2">
            <span
              v-for="(g, i) in parsedGroups"
              :key="i"
              class="px-3 py-1 rounded-full text-xs font-medium text-white"
              :style="{ backgroundColor: groupColor(i) }"
            >
              {{ g }}
            </span>
          </div>
        </div>

        <!-- ─── STEP 1: Date Range / Interval ─── -->
        <div v-if="currentStep === 1" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Start Date</label>
              <input
                type="date"
                v-model="dateStart"
                class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">End Date</label>
              <input
                type="date"
                v-model="dateEnd"
                class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
          </div>

          <!-- Interval or specific dates -->
          <div>
            <label class="block text-sm font-medium mb-2">Scheduling Mode</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="m in scheduleModes"
                :key="m.value"
                @click="scheduleMode = m.value"
                class="px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                :class="
                  scheduleMode === m.value
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                "
              >
                {{ m.label }}
              </button>
            </div>
          </div>

          <!-- Weekday picker (interval mode) -->
          <div v-if="scheduleMode === 'weekdays'" class="space-y-2">
            <label class="block text-sm font-medium">Repeat on</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="day in weekdays"
                :key="day.value"
                @click="toggleWeekday(day.value)"
                class="min-w-[44px] min-h-[44px] rounded-full text-sm font-medium transition-all"
                :class="
                  selectedWeekdays.includes(day.value)
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                "
              >
                {{ day.label.slice(0, 2) }}
              </button>
            </div>
          </div>

          <!-- Every N days (interval mode) -->
          <div v-if="scheduleMode === 'interval'" class="flex items-center gap-3">
            <label class="text-sm font-medium whitespace-nowrap">Every</label>
            <input
              type="number"
              v-model.number="intervalDays"
              min="1"
              max="365"
              class="w-20 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-center"
            />
            <label class="text-sm font-medium">day{{ intervalDays !== 1 ? 's' : '' }}</label>
          </div>

          <!-- Date preview -->
          <div v-if="previewDates.length" class="space-y-1.5">
            <p class="text-xs text-neutral-500 font-medium">
              {{ previewDates.length }} slots generated
            </p>
            <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              <span
                v-for="d in previewDates.slice(0, 20)"
                :key="d"
                class="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300"
              >
                {{ formatShort(d) }}
              </span>
              <span v-if="previewDates.length > 20" class="px-2 py-0.5 text-xs text-neutral-400">
                +{{ previewDates.length - 20 }} more
              </span>
            </div>
          </div>
        </div>

        <!-- ─── STEP 2: Spin! ─── -->
        <div v-if="currentStep === 2" class="space-y-6">
          <!-- Wheel canvas -->
          <div class="flex flex-col items-center gap-4">
            <div class="relative">
              <!-- Pointer -->
              <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div
                  class="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent border-b-rose-600 drop-shadow-sm"
                />
              </div>
              <canvas ref="wheelCanvas" width="280" height="280" class="rounded-full shadow-lg" />
            </div>

            <UiButton
              @click="spinWheel"
              :disabled="spinning || !canSpin"
              size="lg"
              class="w-40 rounded-full"
            >
              <Shuffle v-if="!spinning" class="w-4 h-4 mr-2" />
              <span>{{ spinning ? 'Spinning…' : spinCount === 0 ? 'Spin All!' : 'Re-spin' }}</span>
            </UiButton>
          </div>

          <!-- Result table -->
          <div v-if="assignments.length" class="space-y-2">
            <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Assignments</p>
            <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <div
                v-for="(a, i) in assignments"
                :key="i"
                class="flex items-center gap-3 px-3 py-2 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              >
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: groupColor(a.groupIndex) }"
                />
                <span class="font-medium text-sm flex-1">{{ a.group }}</span>
                <span class="text-xs text-neutral-400">{{ formatShort(a.date) }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="!spinning" class="text-center text-sm text-neutral-400 py-4">
            Press Spin to assign groups to dates!
          </div>
        </div>

        <!-- ─── STEP 3: Confirm & Create Events ─── -->
        <div v-if="currentStep === 3" class="space-y-4">
          <div class="space-y-1.5">
            <UiLabel for="spin-event-title">Event Title Template</UiLabel>
            <UiInput
              id="spin-event-title"
              v-model="eventTitle"
              placeholder="e.g. Training Session"
            />
            <p class="text-xs text-neutral-400">Group name will be appended automatically.</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">Start Time</label>
              <input
                type="time"
                v-model="eventStartTime"
                class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">Duration</label>
              <select
                v-model="eventDuration"
                class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              >
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </div>
          </div>

          <!-- Summary -->
          <div class="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-4 space-y-2">
            <p class="text-sm font-medium">Summary</p>
            <p class="text-sm text-neutral-500">
              Creating
              <strong class="text-neutral-800 dark:text-neutral-100"
                >{{ assignments.length }} events</strong
              >
              for
              <strong class="text-neutral-800 dark:text-neutral-100"
                >{{ parsedGroups.length }} groups</strong
              >
              from {{ formatShort(dateStart) }} to {{ formatShort(dateEnd) }}.
            </p>
          </div>
        </div>

        <!-- Navigation -->
        <div class="flex gap-3 pt-2">
          <UiButton v-if="currentStep > 0" @click="currentStep--" variant="outline" class="flex-1">
            Back
          </UiButton>
          <UiButton
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            class="flex-1"
            :disabled="!canProceed"
          >
            {{ currentStep === 2 && assignments.length === 0 ? 'Skip' : 'Next' }}
          </UiButton>
          <UiButton
            v-if="currentStep === steps.length - 1"
            @click="createAllEvents"
            class="flex-1"
            :disabled="creating"
          >
            <CalendarCheck class="w-4 h-4 mr-2" />
            Create Events
          </UiButton>
        </div>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Shuffle, X, Check, CalendarCheck } from 'lucide-vue-next'
import { useEventsStore } from '@/stores/event'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import {
  rotateWeekdayLabels,
  formatDateShort as formatDateShortByPreference,
} from '@/lib/dateTimePreferences'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  groupId: { type: String, required: true },
  tags: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'done'])

// ── Stores ──────────────────────────────────────────────
const eventsStore = useEventsStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

// ── Step state ──────────────────────────────────────────
const steps = ['Groups', 'Dates', 'Spin!', 'Confirm']
const currentStep = ref(0)

// ── Step 0: Groups ──────────────────────────────────────
const groupsRaw = ref('')
const parsedGroups = computed(() => {
  const raw = groupsRaw.value.trim()
  if (!raw) return []
  // Support newline or comma separated
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
})

// ── Step 1: Dates ───────────────────────────────────────
const toLocalDateInputValue = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
const parseLocalDate = (yyyyMmDd) => {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
const today = toLocalDateInputValue()
const dateStart = ref(today)
const dateEnd = ref('')
const scheduleMode = ref('weekdays') // 'weekdays' | 'interval'
const scheduleModes = [
  { value: 'weekdays', label: '📅 Specific weekdays' },
  { value: 'interval', label: '🔁 Every N days' },
]
const selectedWeekdays = ref([1, 2, 3, 4, 5]) // Mon–Fri by default
const weekdays = computed(() =>
  rotateWeekdayLabels(preferencesStore.weekStartsOn).map((label, offset) => ({
    label,
    value: (preferencesStore.weekStartsOn + offset) % 7,
  })),
)
const intervalDays = ref(7)

const toggleWeekday = (dayIndex) => {
  const idx = selectedWeekdays.value.indexOf(dayIndex)
  if (idx === -1) selectedWeekdays.value.push(dayIndex)
  else selectedWeekdays.value.splice(idx, 1)
}

const previewDates = computed(() => {
  if (!dateStart.value || !dateEnd.value) return []
  const start = parseLocalDate(dateStart.value)
  const end = parseLocalDate(dateEnd.value)
  if (end < start) return []
  const dates = []
  const cur = new Date(start)
  while (cur <= end && dates.length < 200) {
    if (scheduleMode.value === 'weekdays') {
      if (selectedWeekdays.value.includes(cur.getDay())) {
        dates.push(toLocalDateInputValue(cur))
      }
      cur.setDate(cur.getDate() + 1)
    } else {
      dates.push(toLocalDateInputValue(cur))
      cur.setDate(cur.getDate() + intervalDays.value)
    }
  }
  return dates
})

// ── Step 2: Wheel ────────────────────────────────────────
const wheelCanvas = ref(null)
const spinning = ref(false)
const spinCount = ref(0)
const assignments = ref([])

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
]

const groupColor = (i) => COLORS[i % COLORS.length]

const canSpin = computed(() => parsedGroups.value.length > 0 && previewDates.value.length > 0)

function drawWheel(rotationDeg = 0) {
  const canvas = wheelCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const groups = parsedGroups.value
  if (!groups.length) return

  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const radius = cx - 4
  const sliceAngle = (2 * Math.PI) / groups.length
  const rotationRad = (rotationDeg * Math.PI) / 180

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()

  groups.forEach((g, i) => {
    const start = rotationRad + i * sliceAngle
    const end = start + sliceAngle

    // Slice
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, start, end)
    ctx.closePath()
    ctx.fillStyle = groupColor(i)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Label
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(start + sliceAngle / 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${groups.length > 8 ? 10 : 13}px sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 3
    const maxLen = 12
    const label = g.length > maxLen ? g.slice(0, maxLen) + '…' : g
    ctx.fillText(label, radius - 8, 5)
    ctx.restore()
  })

  // Center circle
  ctx.beginPath()
  ctx.arc(cx, cy, 20, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  ctx.stroke()
}

// Watch for group changes and redraw
watch(
  parsedGroups,
  () => {
    nextTick(() => drawWheel())
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      nextTick(() => drawWheel())
    }
  },
)

async function spinWheel() {
  if (spinning.value || !canSpin.value) return
  spinning.value = true

  const groups = [...parsedGroups.value]
  const dates = [...previewDates.value]

  // Shuffle groups (Fisher-Yates)
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[groups[i], groups[j]] = [groups[j], groups[i]]
  }

  // Animate the wheel
  const totalRotation = 360 * 5 + Math.random() * 360
  const duration = 3000
  const start = performance.now()

  await new Promise((resolve) => {
    function frame(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      drawWheel(eased * totalRotation)
      if (progress < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })

  // Build assignments: cycle through dates, assign each group a slot
  const result = []
  for (let i = 0; i < groups.length; i++) {
    const dateIndex = i % dates.length
    result.push({
      group: groups[i],
      groupIndex: parsedGroups.value.indexOf(groups[i]),
      date: dates[dateIndex],
    })
  }

  assignments.value = result
  spinCount.value++
  spinning.value = false
}

// ── Step 3: Confirm ──────────────────────────────────────
const eventTitle = ref('')
const eventStartTime = ref('09:00')
const eventDuration = ref(60)
const creating = ref(false)

async function createAllEvents() {
  if (creating.value) return
  creating.value = true
  try {
    for (const a of assignments.value) {
      const [hour, minute] = eventStartTime.value.split(':').map(Number)
      const startDt = parseLocalDate(a.date)
      startDt.setHours(hour, minute, 0, 0)
      const endDt = new Date(startDt.getTime() + eventDuration.value * 60 * 1000)

      await eventsStore.createEvent({
        title: `${eventTitle.value || 'Event'} – ${a.group}`,
        notes: `Auto-scheduled by Spin Scheduler`,
        start: startDt.toISOString(),
        end: endDt.toISOString(),
        people: [],
        tagId: null,
        groupId: props.groupId,
        userId: authStore.user.$id,
      })
    }
    emit('done')
    emit('update:modelValue', false)
  } finally {
    creating.value = false
  }
}

// ── Helpers ──────────────────────────────────────────────
const formatShort = (dateStr) => {
  if (!dateStr) return '—'
  return formatDateShortByPreference(dateStr, preferencesStore.dateFormat, true)
}

const canProceed = computed(() => {
  if (currentStep.value === 0) return parsedGroups.value.length >= 1
  if (currentStep.value === 1)
    return dateStart.value && dateEnd.value && previewDates.value.length > 0
  if (currentStep.value === 2) return true // can skip
  return true
})

function nextStep() {
  if (!canProceed.value) return
  currentStep.value++
  if (currentStep.value === 2) {
    nextTick(() => drawWheel())
  }
}
</script>
