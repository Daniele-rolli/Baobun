<template>
  <UiDialog :open="showModal" @update:open="$emit('close')">
    <UiDialogContent class="sm:max-w-lg">
      <UiDialogHeader>
        <UiDialogTitle>Bulk Schedule</UiDialogTitle>
      </UiDialogHeader>

      <div class="gap-4 space-y-4">
        <!-- Title -->
        <div class="space-y-1.5">
          <UiLabel for="bulk-title">Title</UiLabel>
          <UiInput id="bulk-title" v-model="title" placeholder="Enter event title" required />
        </div>

        <!-- Start Date -->
        <div>
          <label class="block text-sm font-medium mb-1.5">Start Date</label>
          <input
            type="date"
            v-model="start"
            class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
          />
        </div>

        <!-- Max People per Event -->
        <div class="space-y-1.5">
          <UiLabel for="bulk-group-size">Max People per Event</UiLabel>
          <UiInput id="bulk-group-size" v-model="groupSize" type="number" :min="1" />
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-sm font-medium mb-1.5">Notes</label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Add notes for all generated events"
            class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
          ></textarea>
        </div>

        <!-- Tags Dropdown -->
        <label class="block text-sm font-semibold mb-2">Tags</label>
        <UiSelect v-model="tagId" autocomplete="both">
          <UiSelectTrigger class="w-full">
            <UiSelectValue placeholder="Search tags..." />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem
              v-for="item in tagsStore.items"
              :key="item.$id"
              :value="item.$id"
              :text-value="item.name"
            >
              <span class="flex items-center gap-2">
                <span
                  class="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                  :style="{ backgroundColor: item.color }"
                >
                  <img
                    v-if="item.imageUrl"
                    :src="item.imageUrl"
                    class="w-full h-full rounded-full object-cover"
                    :alt="item.name"
                  />
                </span>
                {{ item.name }}
              </span>
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>

        <!-- Select Days -->
        <div class="my-4 mx-2 space-y-3">
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
            >Select Days</label
          >
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            <button
              v-for="day in daysOfWeek"
              :key="day"
              @click="toggleDay(day)"
              class="flex items-center justify-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-200"
              :class="{
                'bg-rose-500 text-white shadow-sm': selectedDays[day],
                'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700':
                  !selectedDays[day],
              }"
            >
              {{ day.slice(0, 3) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <UiDialogFooter>
        <div class="flex gap-3 w-full">
          <UiButton @click="$emit('close')" variant="outline" class="flex-1"> Close </UiButton>
          <UiButton @click="handleBulkSchedule" class="flex-1"> Schedule </UiButton>
        </div>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useEventsStore } from '@/stores/event'
import { useAuthStore } from '@/stores/auth'
import { useTagsStore } from '@/stores/tag'
import { useGroupsStore } from '@/stores/group'

export default {
  props: { groupId: { type: String, required: true } },
  data() {
    return { showModal: true }
  },
  emits: ['close', 'event-added'],
  setup(props, { emit }) {
    const tagsStore = useTagsStore()
    const groupStore = useGroupsStore()
    const eventsStore = useEventsStore()
    const authStore = useAuthStore()

    const title = ref('')
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
    const start = ref(toLocalDateInputValue())
    const groupSize = ref(1)
    const notes = ref('')
    const tagId = ref('')
    const members = ref([])
    const selectedDays = reactive({
      Monday: false,
      Tuesday: false,
      Wednesday: false,
      Thursday: false,
      Friday: false,
      Saturday: false,
      Sunday: false,
    })
    const daysOfWeek = Object.keys(selectedDays)

    const toggleDay = (day) => (selectedDays[day] = !selectedDays[day])

    const shuffleArray = (array) =>
      array
        .map((v) => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((o) => o.v)

    const getNextEventDates = (startDate, weekdays, count) => {
      const result = []
      const dayMap = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      }
      const targetDays = weekdays.map((d) => dayMap[d])
      let currentDate = parseLocalDate(startDate)

      while (result.length < count) {
        const dayOfWeek = currentDate.getDay()
        if (targetDays.includes(dayOfWeek)) {
          result.push(new Date(currentDate))
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      return result
    }

    async function handleBulkSchedule() {
      const normalizedGroupSize = Math.floor(Number(groupSize.value))
      if (
        !title.value ||
        !start.value ||
        !Number.isFinite(normalizedGroupSize) ||
        normalizedGroupSize < 1
      ) {
        alert('Set a valid max people per event (minimum 1)')
        return
      }

      const chosenDays = Object.keys(selectedDays).filter((d) => selectedDays[d])
      if (!chosenDays.length) {
        alert('Select at least one day')
        return
      }

      const shuffledPeople = shuffleArray(members.value)
      const totalFullGroups = Math.floor(shuffledPeople.length / normalizedGroupSize)
      const remainder = shuffledPeople.length % normalizedGroupSize
      const totalEvents = remainder > 0 ? totalFullGroups + 1 : totalFullGroups

      const eventDates = getNextEventDates(start.value, chosenDays, totalEvents)

      let startIndex = 0
      for (let i = 0; i < totalEvents; i++) {
        let size = normalizedGroupSize
        if (i === totalEvents - 1 && remainder > 0) size = remainder
        const assigned = shuffledPeople.slice(startIndex, startIndex + size)
        startIndex += size

        if (!assigned.length) continue

        const eventDate = eventDates[i] || eventDates[eventDates.length - 1]
        const startTime = new Date(eventDate)
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

        await eventsStore.createEvent({
          title: `${title.value} #${i + 1}`,
          notes: notes.value || '',
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          people: assigned.map((p) => p.$id),
          tagId: tagId.value,
          groupId: props.groupId,
          userId: authStore.user.$id,
        })
      }

      emit('close')
    }

    onMounted(async () => {
      if (!props.groupId) return
      await tagsStore.fetchByGroup(props.groupId)
      members.value = await groupStore.getMembers(props.groupId, authStore.user)
    })

    return {
      start,
      title,
      groupSize,
      notes,
      tagId,
      members,
      selectedDays,
      daysOfWeek,
      toggleDay,
      tagsStore,
      handleBulkSchedule,
    }
  },
}
</script>
