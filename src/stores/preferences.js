import { defineStore } from 'pinia'
import { ref } from 'vue'

export const DATE_FORMATS = ['mdy', 'dmy', 'ymd']
export const TIME_FORMATS = ['12h', '24h']

export const usePreferencesStore = defineStore(
  'preferences',
  () => {
    const weekStartsOn = ref(0)
    const dateFormat = ref('mdy')
    const timeFormat = ref('12h')

    const setWeekStartsOn = (value) => {
      const normalized = Number(value)
      weekStartsOn.value = Number.isInteger(normalized) && normalized >= 0 && normalized <= 6 ? normalized : 0
    }

    const setDateFormat = (value) => {
      dateFormat.value = DATE_FORMATS.includes(value) ? value : 'mdy'
    }

    const setTimeFormat = (value) => {
      timeFormat.value = TIME_FORMATS.includes(value) ? value : '12h'
    }

    return {
      weekStartsOn,
      dateFormat,
      timeFormat,
      setWeekStartsOn,
      setDateFormat,
      setTimeFormat,
    }
  },
  {
    persist: {
      key: 'preferences',
      storage: localStorage,
      paths: ['weekStartsOn', 'dateFormat', 'timeFormat'],
    },
  },
)
