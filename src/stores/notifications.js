import { defineStore } from 'pinia'
import { ref } from 'vue'

const REMINDER_OPTIONS = [2880, 1440, 0]
const DEFAULT_LEAD_MINUTES = 1440

const normalizeLeadMinutesValue = (value) => {
  const parsed = Number(value)
  return REMINDER_OPTIONS.includes(parsed) ? parsed : DEFAULT_LEAD_MINUTES
}

export const useNotificationsStore = defineStore(
  'notifications',
  () => {
    const enabled = ref(false)
    const leadMinutes = ref(DEFAULT_LEAD_MINUTES)
    const permission = ref(
      typeof Notification !== 'undefined' ? Notification.permission : 'default',
    )
    const unsupported = ref(typeof Notification === 'undefined')

    const syncPermission = () => {
      if (typeof Notification === 'undefined') {
        unsupported.value = true
        permission.value = 'denied'
        enabled.value = false
        return
      }

      unsupported.value = false
      permission.value = Notification.permission
      if (permission.value !== 'granted') enabled.value = false
    }

    const requestPermission = async () => {
      if (typeof Notification === 'undefined') {
        unsupported.value = true
        permission.value = 'denied'
        enabled.value = false
        return false
      }

      const result = await Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') enabled.value = false
      return result === 'granted'
    }

    const setEnabled = async (nextValue) => {
      if (!nextValue) {
        enabled.value = false
        return true
      }

      syncPermission()
      if (permission.value === 'granted') {
        enabled.value = true
        return true
      }

      const granted = await requestPermission()
      enabled.value = granted
      return granted
    }

    const setLeadMinutes = (value) => {
      leadMinutes.value = normalizeLeadMinutesValue(value)
    }

    const normalizeLeadMinutes = () => {
      leadMinutes.value = normalizeLeadMinutesValue(leadMinutes.value)
    }

    return {
      enabled,
      leadMinutes,
      permission,
      unsupported,
      syncPermission,
      requestPermission,
      setEnabled,
      setLeadMinutes,
      normalizeLeadMinutes,
    }
  },
  {
    persist: {
      key: 'notifications',
      storage: localStorage,
      paths: ['enabled', 'leadMinutes'],
    },
  },
)
