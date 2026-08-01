import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as eventService from '@/lib/services/events'

export const useEventsStore = defineStore('events', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((e) => [e.$id, e])))

  async function fetchByGroup(groupId) {
    try {
      loading.value = true
      const res = await eventService.listByGroup(groupId)
      items.value = res.events
    } catch (err) {
      console.error('Failed to fetch events:', err)
      error.value = err
    } finally {
      loading.value = false
    }
  }

  async function createEvent(payload) {
    const res = await eventService.create(payload.groupId, payload)
    items.value.push(res.event)
    return res.event
  }

  async function updateEvent(id, patch) {
    const res = await eventService.update(id, patch)
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.event
    return res.event
  }

  async function deleteEvent(id) {
    await eventService.remove(id)
    items.value = items.value.filter((e) => e.$id !== id)
  }

  async function moveEventDate(id, newLocalDateYYYYMMDD) {
    const ev = items.value.find((e) => e.$id === id)
    if (!ev || !ev.start) return
    const currentStart = new Date(ev.start)
    if (!Number.isFinite(currentStart.getTime())) return

    const [y, m, d] = String(newLocalDateYYYYMMDD).split('-').map(Number)
    if (!y || !m || !d) return

    const moved = new Date(y, m - 1, d)
    moved.setHours(
      currentStart.getHours(),
      currentStart.getMinutes(),
      currentStart.getSeconds(),
      currentStart.getMilliseconds(),
    )

    const res = await eventService.moveDate(id, moved.toISOString())
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.event
    return res.event
  }

  return {
    items,
    byId,
    loading,
    error,
    fetchByGroup,
    createEvent,
    updateEvent,
    deleteEvent,
    moveEventDate,
  }
})
