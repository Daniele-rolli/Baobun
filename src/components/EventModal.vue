<template>
  <UiDialog :open="visible" @update:open="$emit('close')">
    <UiDialogContent class="sm:max-w-lg">
      <UiDialogHeader>
        <UiDialogTitle>{{ event ? 'Edit Event' : 'Add New Event' }}</UiDialogTitle>
      </UiDialogHeader>

      <form @submit.prevent="saveEvent" class="space-y-5">
        <!-- Title -->
        <div class="space-y-1.5">
          <UiLabel for="event-title">Title</UiLabel>
          <UiInput id="event-title" v-model="title" placeholder="Enter event title" required />
        </div>

        <!--
          Time Fields
          iOS FIX: Added `min-w-0` to the wrapper and both child divs so the
          grid/flex children can shrink below their intrinsic content width on
          Safari. Also added the datetime-input class which resets the webkit
          shadow-DOM padding that causes overflow (see <style> below).
        -->
        <div class="flex flex-col sm:grid sm:grid-cols-2 gap-4 min-w-0">
          <div class="min-w-0">
            <label class="block text-sm font-medium mb-2">Start Time</label>
            <input
              v-model="start"
              type="datetime-local"
              class="datetime-input w-full min-w-0 rounded-xl border px-4 py-3 focus:border-rose-600 focus:ring-2 focus:ring-rose-600 focus:outline-none transition-colors"
              required
            />
          </div>
          <div class="min-w-0">
            <label class="block text-sm font-medium mb-2">End Time</label>
            <input
              v-model="end"
              type="datetime-local"
              class="datetime-input w-full min-w-0 rounded-xl border px-4 py-3 focus:border-rose-600 focus:ring-2 focus:ring-rose-600 focus:outline-none transition-colors"
              required
            />
          </div>
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-sm font-medium mb-2">Notes</label>
          <textarea
            v-model="notes"
            class="w-full rounded-xl border px-4 py-3 placeholder-neutral-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-600 focus:outline-none transition-colors resize-none"
            rows="3"
            placeholder="Add any additional notes..."
          ></textarea>
        </div>

        <!-- People (multi-select) -->
        <div>
          <label class="block text-sm font-medium mb-2">People</label>
          <UiSelect v-model="people" multiple autocomplete="both">
            <UiSelectTrigger class="w-full">
              <UiSelectValue placeholder="Select people..." />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="m in members" :key="m.id" :value="m.id" :text-value="m.name">
                <img
                  :src="
                    m.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.userId)}&background=f1f5f9&color=64748b`
                  "
                  class="w-6 h-6 rounded-full border flex-shrink-0"
                  :alt="m.name || m.userId"
                />
                {{ m.name }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <!-- Tag (single-select with create option) -->
        <div>
          <label class="block text-sm font-medium mb-2">Tag</label>
          <UiSelect v-model="tagId" autocomplete="both">
            <UiSelectTrigger class="w-full">
              <UiSelectValue placeholder="Select or create tag..." />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="t in tagsStore.items"
                :key="t.id"
                :value="t.id"
                :text-value="t.name"
              >
                <div
                  class="w-6 h-6 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: t.color }"
                >
                  <img
                    v-if="t.imageUrl"
                    :src="t.imageUrl"
                    class="w-full h-full rounded-full object-cover"
                    :alt="t.name"
                  />
                </div>
                {{ t.name }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>

          <!-- Optional: Expandable Create Tag Form -->
          <!-- Toggle button -->
          <div class="mt-2">
            <button
              type="button"
              class="text-sm text-rose-600 hover:underline"
              @click="showCreateTag = !showCreateTag"
            >
              {{ showCreateTag ? 'Hide Create Tag' : 'Create New Tag' }}
            </button>
          </div>

          <!-- Collapsible form -->
          <div
            v-show="showCreateTag"
            class="mt-3 p-4 border rounded-xl bg-neutral-50 dark:bg-neutral-800 space-y-3"
          >
            <UiInput v-model="newTagName" placeholder="Tag name" />
            <div class="flex justify-between">
              <div>
                <label class="block text-xs font-medium mb-1">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  @change="handleFileUpload"
                  class="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition-colors"
                />
                <div v-if="previewImage" class="mt-2">
                  <img
                    :src="previewImage"
                    alt="Preview"
                    class="h-8 w-8 rounded-full object-cover border border-neutral-200"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Color</label>
                <label class="inline-flex items-center cursor-pointer">
                  <input v-model="newTagColor" type="color" class="sr-only" />
                  <span
                    class="w-8 h-8 rounded-lg shadow-sm"
                    :style="{ backgroundColor: newTagColor }"
                  ></span>
                </label>
              </div>
            </div>
            <UiButton
              type="button"
              class="w-full"
              :disabled="!newTagName.trim()"
              @click="createTag"
            >
              Create Tag
            </UiButton>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <UiLabel>Reminder</UiLabel>
            <UiSelect v-model="reminder">
              <UiSelectTrigger class="w-full">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="none">No reminder</UiSelectItem>
                <UiSelectItem value="0">At start time</UiSelectItem>
                <UiSelectItem value="10">10 minutes before</UiSelectItem>
                <UiSelectItem value="30">30 minutes before</UiSelectItem>
                <UiSelectItem value="60">1 hour before</UiSelectItem>
                <UiSelectItem value="1440">1 day before</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div v-if="!event" class="space-y-1.5">
            <UiLabel>Repeat</UiLabel>
            <UiSelect v-model="recurrenceFrequency">
              <UiSelectTrigger class="w-full">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="none">Does not repeat</UiSelectItem>
                <UiSelectItem value="DAILY">Daily</UiSelectItem>
                <UiSelectItem value="WEEKLY">Weekly</UiSelectItem>
                <UiSelectItem value="MONTHLY">Monthly</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </div>

        <div v-if="!event && recurrenceFrequency !== 'none'" class="space-y-1.5">
          <UiLabel for="recurrence-count">Number of occurrences</UiLabel>
          <UiInput
            id="recurrence-count"
            v-model.number="recurrenceCount"
            type="number"
            min="2"
            max="366"
          />
          <p class="text-xs text-muted-foreground">Includes the first event.</p>
        </div>

        <!-- Actions -->
        <div v-if="event">
          <UiButton
            type="button"
            variant="destructive"
            class="w-full"
            @click="showDeleteConfirm = true"
          >
            Delete
          </UiButton>
        </div>

        <div class="flex gap-3">
          <UiButton type="button" variant="outline" class="flex-1" @click="$emit('close')">
            Cancel
          </UiButton>
          <UiButton type="submit" class="flex-1" :disabled="saving">
            {{ saving ? 'Saving…' : event ? 'Update Event' : 'Add Event' }}
          </UiButton>
        </div>
      </form>
    </UiDialogContent>

    <UiAlertDialog v-model:open="showDeleteConfirm">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>Delete Event</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            Are you sure you want to delete this event?
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>Cancel</UiAlertDialogCancel>
          <UiAlertDialogAction variant="destructive" @click="confirmDeleteEvent">
            Delete
          </UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </UiDialog>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEventsStore } from '@/stores/event'
import { useTagsStore } from '@/stores/tag'
import { useGroupsStore } from '@/stores/group'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  groupId: { type: String, required: true },
  visible: { type: Boolean, default: true },
  event: { type: Object, default: null },
  defaultDate: { type: Date, default: null },
})
const emit = defineEmits(['close', 'event-added', 'event-updated', 'tag-created', 'event-deleted'])
const authStore = useAuthStore()
const eventsStore = useEventsStore()
const tagsStore = useTagsStore()
const groupStore = useGroupsStore()
const toast = useToastStore()

const title = ref('')
const start = ref(new Date().toISOString().slice(0, 16))
const end = ref(new Date(Date.now() + 3600000).toISOString().slice(0, 16))
const notes = ref('')
const people = ref([])
const members = ref([])
const tagId = ref('') // single-select
const showDeleteConfirm = ref(false)
const showCreateTag = ref(false)
const newTagName = ref('')
const newTagColor = ref('#F87171')
const newTagImageFile = ref(null)
const previewImage = ref('')
const reminder = ref('none')
const recurrenceFrequency = ref('none')
const recurrenceCount = ref(10)
const saving = ref(false)

const handleFileUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    newTagImageFile.value = file
    previewImage.value = URL.createObjectURL(file)
  }
}

const createTag = async () => {
  const name = newTagName.value?.trim()
  const color = newTagColor.value

  if (!name || !color) return // stop if empty

  // Pass groupId as first argument
  let tag
  try {
    tag = await tagsStore.createTag(props.groupId, {
      name,
      color,
      imageFile: newTagImageFile.value,
      icon: null,
    })
  } catch (error) {
    toast.error('Could not create tag', error?.message)
    return
  }

  tagId.value = tag.id
  emit('tag-created', tag)

  // Reset form & collapse
  showCreateTag.value = false
  newTagName.value = ''
  newTagColor.value = '#F87171'
  newTagImageFile.value = null
  previewImage.value = ''
  toast.success('Tag created')
}

const saveEvent = async () => {
  if (!title.value || !start.value || !end.value) return
  const startDate = new Date(start.value)
  const endDate = new Date(end.value)
  const safeEndDate = endDate > startDate ? endDate : new Date(startDate.getTime() + 3600000)

  const eventData = {
    title: title.value,
    notes: notes.value || '',
    start: startDate.toISOString(),
    end: safeEndDate.toISOString(),
    people: people.value,
    tagId: tagId.value || '',
    reminderMinutes: reminder.value === 'none' ? null : Number(reminder.value),
  }
  if (!props.event && recurrenceFrequency.value !== 'none') {
    eventData.recurrence = {
      frequency: recurrenceFrequency.value,
      interval: 1,
      count: Math.min(366, Math.max(2, Number(recurrenceCount.value) || 2)),
    }
  }
  saving.value = true
  try {
    if (props.event) {
      await eventsStore.updateEvent(props.event.id, eventData)
      emit('event-updated')
      toast.success('Event updated')
    } else {
      await eventsStore.createEvent({
        ...eventData,
        userId: authStore.user.id,
        groupId: props.groupId,
      })
      emit('event-added')
      toast.success(
        recurrenceFrequency.value === 'none' ? 'Event created' : 'Recurring events created',
      )
    }
    emit('close')
  } catch (error) {
    toast.error('Could not save event', error?.message)
  } finally {
    saving.value = false
  }
}

const confirmDeleteEvent = async () => {
  if (!props.event) return
  showDeleteConfirm.value = false
  try {
    await eventsStore.deleteEvent(props.event.id)
    emit('event-deleted')
    emit('close')
    toast.success('Event deleted')
  } catch (error) {
    toast.error('Could not delete event', error?.message)
  }
}

const formatLocalDateTime = (date) => {
  const d = new Date(date)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

const resetForm = () => {
  if (props.event) {
    title.value = props.event.title
    start.value = formatLocalDateTime(props.event.start)
    end.value = formatLocalDateTime(props.event.end)
    notes.value = props.event.notes
    people.value = props.event.people || []
    tagId.value = props.event.tagId || ''
    reminder.value =
      props.event.reminderMinutes === null || props.event.reminderMinutes === undefined
        ? 'none'
        : String(props.event.reminderMinutes)
  } else {
    title.value = ''
    const base = props.defaultDate ? new Date(props.defaultDate) : new Date()
    base.setHours(9, 0, 0, 0)
    const endBase = new Date(base.getTime() + 3600000)

    start.value = formatLocalDateTime(base)
    end.value = formatLocalDateTime(endBase)
    notes.value = ''
    people.value = []
    tagId.value = ''
    reminder.value = 'none'
    recurrenceFrequency.value = 'none'
    recurrenceCount.value = 10
  }
  showCreateTag.value = false
  showDeleteConfirm.value = false
}

onMounted(async () => {
  const fetchedMembers = await groupStore.getMembers(props.groupId, authStore.user)
  members.value = [
    {
      id: 'everyone',
      name: 'Everyone',
      avatarUrl: 'https://ui-avatars.com/api/?name=Everyone&background=f1f5f9&color=64748b',
    },
    ...fetchedMembers,
  ]
  await tagsStore.fetchByGroup(props.groupId)
  resetForm()
})

watch(
  () => props.visible,
  (val) => val && resetForm(),
)

watch(start, (value) => {
  if (!value) return
  const startDate = new Date(value)
  const endDate = new Date(end.value)
  if (!end.value || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    end.value = formatLocalDateTime(new Date(startDate.getTime() + 3600000))
  }
})
</script>

<!--
  iOS datetime-local fixes
  ========================
  Safari renders datetime-local inputs with internal shadow-DOM parts
  (-webkit-datetime-edit-*) that carry their own padding. This causes:
    1. The input to be wider than its container (horizontal overflow in the
       2-col grid row) because `width: 100%` is effectively ignored by Safari
       when the inner content is wider than the container.
    2. Inconsistent vertical height vs. regular text inputs.

  Fix: zero out all the inner webkit padding and let our own px-4 py-3
  classes control spacing uniformly. The `min-w-0` classes in the template
  handle the flex/grid shrink side.
-->
<style scoped>
.datetime-input::-webkit-datetime-edit,
.datetime-input::-webkit-datetime-edit-fields-wrapper,
.datetime-input::-webkit-datetime-edit-text,
.datetime-input::-webkit-datetime-edit-minute-field,
.datetime-input::-webkit-datetime-edit-hour-field,
.datetime-input::-webkit-datetime-edit-meridiem-field,
.datetime-input::-webkit-datetime-edit-day-field,
.datetime-input::-webkit-datetime-edit-month-field,
.datetime-input::-webkit-datetime-edit-year-field {
  padding: 0;
}

/* Prevent the calendar/clock icon from inflating the input height */
.datetime-input::-webkit-inner-spin-button {
  height: auto;
}

/* Ensure the input doesn't blow past its container on iOS Safari */
.datetime-input {
  /* Safari respects max-width even when it ignores width on temporal inputs */
  max-width: 100%;
  /* Forces the inner flex layout to wrap rather than overflow */
  box-sizing: border-box;
}
</style>
