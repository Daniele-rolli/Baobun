import { defineStore } from 'pinia'
import { ref } from 'vue'

const uniqueIds = (values) => [...new Set((values || []).filter(Boolean))]

export const useCalendarFeedStore = defineStore(
  'calendarFeed',
  () => {
    const enabledGroupIds = ref([])
    const lastSyncedAtByGroup = ref({})
    const lastSignatureByGroup = ref({})

    const isEnabledForGroup = (groupId) => enabledGroupIds.value.includes(groupId)

    const setEnabledForGroup = (groupId, enabled) => {
      if (!groupId) return
      if (enabled) {
        enabledGroupIds.value = uniqueIds([...enabledGroupIds.value, groupId])
        return
      }
      enabledGroupIds.value = enabledGroupIds.value.filter((id) => id !== groupId)
    }

    const setSyncedMetadata = ({ groupId, syncedAt, signature }) => {
      if (!groupId) return
      if (syncedAt)
        lastSyncedAtByGroup.value = { ...lastSyncedAtByGroup.value, [groupId]: syncedAt }
      if (signature != null) {
        lastSignatureByGroup.value = { ...lastSignatureByGroup.value, [groupId]: signature }
      }
    }

    return {
      enabledGroupIds,
      lastSyncedAtByGroup,
      lastSignatureByGroup,
      isEnabledForGroup,
      setEnabledForGroup,
      setSyncedMetadata,
    }
  },
  {
    persist: {
      key: 'calendar-feed',
      storage: localStorage,
      paths: ['enabledGroupIds', 'lastSyncedAtByGroup', 'lastSignatureByGroup'],
    },
  },
)
