<template>
  <UiDialog :open="modelValue" @update:open="$emit('update:modelValue', false)">
    <UiDialogContent class="sm:max-w-2xl">
      <div class="space-y-6 p-1">
        <!-- Header -->
        <UiDialogHeader class="flex-row items-start justify-between text-left">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
            >
              <Shuffle class="w-5 h-5 text-primary" />
            </div>
            <div>
              <UiDialogTitle class="text-lg font-bold">Spin Scheduler</UiDialogTitle>
              <p class="text-xs text-muted-foreground">
                Auto-assign groups to dates by spinning the wheel
              </p>
            </div>
          </div>
          <UiButton
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Close"
            @click="$emit('update:modelValue', false)"
          >
            <X class="w-5 h-5" />
          </UiButton>
        </UiDialogHeader>

        <!-- Step indicator -->
        <div class="flex items-center gap-2">
          <div v-for="(step, i) in steps" :key="i" class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors"
              :class="
                currentStep === i
                  ? 'bg-primary text-primary-foreground'
                  : currentStep > i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              "
            >
              <Check v-if="currentStep > i" class="w-3.5 h-3.5" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-xs text-muted-foreground hidden sm:block">{{ step }}</span>
            <div v-if="i < steps.length - 1" class="w-8 h-px bg-border" />
          </div>
        </div>

        <!-- ─── STEP 0: Enter Groups ─── -->
        <div v-if="currentStep === 0" class="space-y-4">
          <div>
            <UiLabel class="mb-1.5 block"
              >Groups <span class="text-muted-foreground">(one per line or comma-separated)</span></UiLabel
            >
            <UiTextarea
              v-model="groupsRaw"
              class="min-h-[120px]"
              placeholder="Team Alpha&#10;Team Beta&#10;Team Gamma"
            />
            <p class="text-xs text-muted-foreground mt-1">
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
            <div class="space-y-1.5">
              <UiLabel for="spin-start">Start Date</UiLabel>
              <UiInput id="spin-start" type="date" v-model="dateStart" class="min-h-[44px]" />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="spin-end">End Date</UiLabel>
              <UiInput id="spin-end" type="date" v-model="dateEnd" class="min-h-[44px]" />
            </div>
          </div>

          <!-- Interval or specific dates -->
          <div>
            <UiLabel class="mb-2 block">Scheduling Mode</UiLabel>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="m in scheduleModes"
                :key="m.value"
                @click="scheduleMode = m.value"
                class="px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                :class="
                  scheduleMode === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : ' hover:border-border'
                "
              >
                {{ m.label }}
              </button>
            </div>
          </div>

          <!-- Weekday picker (interval mode) -->
          <div v-if="scheduleMode === 'weekdays'" class="space-y-2">
            <UiLabel class="block">Repeat on</UiLabel>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="day in weekdays"
                :key="day.value"
                @click="toggleWeekday(day.value)"
                class="min-w-[44px] min-h-[44px] rounded-full text-sm font-medium transition-all"
                :class="
                  selectedWeekdays.includes(day.value)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                "
              >
                {{ day.label.slice(0, 2) }}
              </button>
            </div>
          </div>

          <!-- Every N days (interval mode) -->
          <div v-if="scheduleMode === 'interval'" class="flex items-center gap-3">
            <UiLabel class="whitespace-nowrap text-sm">Every</UiLabel>
            <UiInput
              type="number"
              v-model.number="intervalDays"
              min="1"
              max="365"
              class="w-20 text-center"
            />
            <UiLabel class="text-sm">day{{ intervalDays !== 1 ? 's' : '' }}</UiLabel>
          </div>

          <!-- Date preview -->
          <div v-if="previewDates.length" class="space-y-1.5">
            <p class="text-xs text-muted-foreground font-medium">
              {{ previewDates.length }} slots generated
            </p>
            <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              <span
                v-for="d in previewDates.slice(0, 20)"
                :key="d"
                class="px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground"
              >
                {{ formatShort(d) }}
              </span>
              <span v-if="previewDates.length > 20" class="px-2 py-0.5 text-xs text-muted-foreground">
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
                  class="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent border-b-primary drop-shadow-sm"
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
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignments</p>
            <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <div
                v-for="(a, i) in assignments"
                :key="i"
                class="flex items-center gap-3 px-3 py-2 rounded-xl border bg-card"
              >
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: groupColor(a.groupIndex) }"
                />
                <span class="font-medium text-sm flex-1">{{ a.group }}</span>
                <span class="text-xs text-muted-foreground">{{ formatShort(a.date) }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="!spinning" class="text-center text-sm text-muted-foreground py-4">
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
            <p class="text-xs text-muted-foreground">Group name will be appended automatically.</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <UiLabel for="spin-time">Start Time</UiLabel>
              <UiInput id="spin-time" type="time" v-model="eventStartTime" class="min-h-[44px]" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>Duration</UiLabel>
              <UiSelect v-model="eventDuration">
                <UiSelectTrigger class="min-h-[44px]">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem value="30">30 min</UiSelectItem>
                  <UiSelectItem value="60">1 hour</UiSelectItem>
                  <UiSelectItem value="90">1.5 hours</UiSelectItem>
                  <UiSelectItem value="120">2 hours</UiSelectItem>
                  <UiSelectItem value="180">3 hours</UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
          </div>

          <!-- Summary -->
          <div class="bg-muted rounded-xl p-4 space-y-2">
            <p class="text-sm font-medium">Summary</p>
            <p class="text-sm text-muted-foreground">
              Creating
              <strong
                >{{ assignments.length }} events</strong
              >
              for
              <strong
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
        userId: authStore.user.id,
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
